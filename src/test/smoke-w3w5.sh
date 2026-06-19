#!/usr/bin/env bash
# Smoke W3-W5 — test full ad creation flow via Meta API
# Run: cd /root/hsl-source && source /root/.hermes/.env 2>/dev/null && bash src/test/smoke-w3w5.sh

set -e

echo "=== SMOKE W3-W5: Full ad creation via file upload ==="
echo ""

# ── Settings ──────────────────────────
AD_ACCOUNT="act_1178670036856360"
AD_ACCOUNT_NUM="1178670036856360"
PAGE_ID="1087756507761450"  # OO 13109 Page
ABO_ADSET=""  # Will find below

echo "1. Cek adimage file upload..."
# Generate test image
python3 -c "from PIL import Image; Image.new('RGB',(200,200),(255,100,50)).save('/tmp/smoke_test.jpg','JPEG')"

RES=$(curl -s -X POST "https://graph.facebook.com/v25.0/${AD_ACCOUNT}/adimages" \
  -F "access_token=$META_TOKEN" \
  -F "file=@/tmp/smoke_test.jpg" \
  -F "published=false")
HASH=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.get('images',{}).keys())[0] if d.get('images') else 'FAIL')" 2>/dev/null)
if [ "$HASH" = "FAIL" ]; then
  echo "  ❌ adimage: $(echo $RES | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message','?'))")"
  exit 1
fi
echo "  ✅ adimage: hash=${HASH:0:12}..."
echo ""

echo "2. Cek creative creation..."
CREATIVE=$(curl -s -X POST "https://graph.facebook.com/v25.0/${AD_ACCOUNT}/adcreatives" \
  -F "access_token=$META_TOKEN" \
  -F "name=SMOKE-CR-$(date +%s)" \
  -F "object_story_spec={\"page_id\":\"$PAGE_ID\",\"link_data\":{\"link\":\"https://example.com\",\"message\":\"Test ad - will be deleted\",\"name\":\"Smoke Test\",\"call_to_action\":{\"type\":\"LEARN_MORE\"},\"attachment_hash\":\"$HASH\"}}" \
  -F "degrees_of_freedom_spec={\"creative_features_spec\":{\"standard_enhancements\":{\"enroll_status\":\"OPT_OUT\"}}}")
CREATIVE_ID=$(echo "$CREATIVE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','FAIL'))" 2>/dev/null)
if [ "$CREATIVE_ID" = "FAIL" ]; then
  echo "  ❌ creative: $(echo $CREATIVE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message','?'))")"
  exit 1
fi
echo "  ✅ creative: $CREATIVE_ID"
echo ""

echo "3. Find PAUSED adset from PAUSED campaign..."
# Get first PAUSED campaign's first adset
CAMP_DATA=$(curl -s "https://graph.facebook.com/v25.0/${AD_ACCOUNT}/campaigns?access_token=$META_TOKEN&fields=id,name,status&limit=5&filter=%5B%7B%22field%22%3A%22campaign.status%22%2C%22operator%22%3A%22IN%22%2C%22value%22%3A%5B%22PAUSED%22%5D%7D%5D")
FIRST_CAMP=$(echo "$CAMP_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('id',''))" 2>/dev/null)
ADSET_DATA=$(curl -s "https://graph.facebook.com/v25.0/${FIRST_CAMP}/adsets?access_token=$META_TOKEN&fields=id,name,status&limit=3")
ADSET_ID=$(echo "$ADSET_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('id',''))" 2>/dev/null)
echo "  Campaign: $FIRST_CAMP"
echo "  Adset: $ADSET_ID"

# PAUSE the adset if not already
ADSET_STATUS=$(curl -s "https://graph.facebook.com/v25.0/${ADSET_ID}?access_token=$META_TOKEN&fields=status")
if echo "$ADSET_STATUS" | grep -q '"PAUSED"'; then
  echo "  Adset already PAUSED"
else
  curl -s -X POST "https://graph.facebook.com/v25.0/${ADSET_ID}" -d "access_token=$META_TOKEN" -d "status=PAUSED" > /dev/null
  echo "  Adset PAUSED for test"
fi
echo ""

echo "4. Create ad PAUSED..."
AD=$(curl -s -X POST "https://graph.facebook.com/v25.0/${AD_ACCOUNT}/ads" \
  -F "access_token=$META_TOKEN" \
  -F "name=SMOKE-AD-$(date +%s)" \
  -F "adset_id=$ADSET_ID" \
  -F "creative={\"creative_id\":$CREATIVE_ID}" \
  -F "status=PAUSED")
AD_ID=$(echo "$AD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','FAIL'))" 2>/dev/null)
if [ "$AD_ID" = "FAIL" ]; then
  echo "  ❌ ad: $(echo $AD | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message','?'))")"
else
  echo "  ✅ ad: $AD_ID"
  # Readback
  AD_CHECK=$(curl -s "https://graph.facebook.com/v25.0/${AD_ID}?access_token=$META_TOKEN&fields=id,status,effective_status")
  echo "  Readback: $(echo $AD_CHECK | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'status={d[\"status\"]} effective={d.get(\"effective_status\",\"?\")}')")"
fi
echo ""

echo "5. CLEANUP..."
echo "  Deleting ad $AD_ID..."
curl -s -X POST "https://graph.facebook.com/v25.0/${AD_ID}" -d "access_token=$META_TOKEN" -d "status=DELETED" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ' + ('✅' if d.get('success') else '❌'))" 2>/dev/null
echo "  Deleting creative $CREATIVE_ID..."
curl -s -X POST "https://graph.facebook.com/v25.0/${CREATIVE_ID}" -d "access_token=$META_TOKEN" -d "status=DELETED" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ' + ('✅' if d.get('success') else '❌'))" 2>/dev/null
echo ""

echo "=== W3 DONE ==="
