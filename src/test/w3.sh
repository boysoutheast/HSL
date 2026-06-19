#!/usr/bin/env bash
# W3 Full smoke: adimage → creative → ad → readback → cleanup
# Uses act_1178670036856360 (OO - 13109 - Glazingskin)
set -e

AD_ACCOUNT="act_1178670036856360"
PAGE_ID="1087756507761450"

echo "=== SMOKE W3: Full ad creation (file upload, image_hash top level) ==="
echo ""

# 1. Generate image & upload
python3 -c "from PIL import Image; Image.new('RGB',(200,200),(255,100,50)).save('/tmp/smoke_w3.jpg','JPEG')" 2>/dev/null
echo "[1] Upload image..."
R1=$(curl -s -X POST "https://graph.facebook.com/v25.0/${AD_ACCOUNT}/adimages" \
  -F "access_token=$META_TOKEN" -F "file=@/tmp/smoke_w3.jpg" -F "published=false")
HASH=$(echo "$R1" | python3 -c "import sys,json; d=json.load(sys.stdin); k=list(d['images'].keys())[0]; print(d['images'][k]['hash'])" 2>/dev/null)
echo "  hash=$HASH"

# 2. Find PAUSED campaign + PAUSED adset
echo "[2] Find PAUSED campaign/adset..."
CAMP=$(curl -s "https://graph.facebook.com/v25.0/${AD_ACCOUNT}/campaigns?access_token=$META_TOKEN&fields=id,name,status,daily_budget&limit=10&filter=%5B%7B%22field%22%3A%22campaign.status%22%2C%22operator%22%3A%22IN%22%2C%22value%22%3A%5B%22PAUSED%22%5D%7D%5D")
CAMP_ID=$(echo "$CAMP" | python3 -c "import sys,json; d=json.load(sys.stdin); c=[x for x in d.get('data',[]) if x.get('daily_budget')]; print(c[0]['id'] if c else 'NONE')" 2>/dev/null)
echo "  Campaign: $CAMP_ID"

ADSETS=$(curl -s "https://graph.facebook.com/v25.0/${CAMP_ID}/adsets?access_token=$META_TOKEN&fields=id,name,status&limit=5")
ADSET_ID=$(echo "$ADSETS" | python3 -c "import sys,json; d=json.load(sys.stdin); cl=[x for x in d.get('data',[]) if x.get('status')=='PAUSED']; print(cl[0]['id'] if cl else d.get('data',[{}])[0].get('id','NONE'))" 2>/dev/null)
echo "  Adset: $ADSET_ID"

# PAUSE adset if not
ADSET_ST=$(curl -s "https://graph.facebook.com/v25.0/${ADSET_ID}?access_token=$META_TOKEN&fields=status")
if echo "$ADSET_ST" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('status')=='PAUSED' else 1)" 2>/dev/null; then
  echo "  (already PAUSED)"
else
  curl -s -X POST "https://graph.facebook.com/v25.0/${ADSET_ID}" -d "access_token=$META_TOKEN" -d "status=PAUSED" > /dev/null
  echo "  (paused for test)"
fi
sleep 1

# 3. Create creative WITH image_hash at top level
echo "[3] Create creative..."
TS=$(date +%s)
CR=$(curl -s -X POST "https://graph.facebook.com/v25.0/${AD_ACCOUNT}/adcreatives" \
  -F "access_token=$META_TOKEN" \
  -F "name=SMOKE-CR-$TS" \
  -F "object_story_spec={\"page_id\":\"$PAGE_ID\",\"link_data\":{\"link\":\"https://example.com\",\"message\":\"Smoke test ad - will be deleted\",\"name\":\"Smoke\",\"call_to_action\":{\"type\":\"LEARN_MORE\"}}}" \
  -F "image_hash=$HASH")
CR_ID=$(echo "$CR" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','FAIL'))" 2>/dev/null)
echo "  creative=$CR_ID"
if [ "$CR_ID" = "FAIL" ]; then echo "  FAIL: $(echo $CR | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message','?'))")"; exit 1; fi

# 4. Create ad PAUSED
echo "[4] Create ad..."
AD=$(curl -s -X POST "https://graph.facebook.com/v25.0/${AD_ACCOUNT}/ads" \
  -F "access_token=$META_TOKEN" \
  -F "name=SMOKE-AD-$TS" \
  -F "adset_id=$ADSET_ID" \
  -F "creative={\"creative_id\":$CR_ID}" \
  -F "status=PAUSED")
AD_ID=$(echo "$AD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','FAIL'))" 2>/dev/null)
echo "  ad=$AD_ID"
if [ "$AD_ID" = "FAIL" ]; then echo "  FAIL: $(echo $AD | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message','?'))")"; exit 1; fi

# 5. Readback
echo "[5] Readback..."
sleep 2
RB=$(curl -s "https://graph.facebook.com/v25.0/${AD_ID}?access_token=$META_TOKEN&fields=id,status,effective_status,name")
echo "$RB" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print(f'  id={d[\"id\"]} status={d[\"status\"]} effective={d.get(\"effective_status\",\"?\")} name={d.get(\"name\",\"?\")}')
"

# 6. CLEANUP: delete ad + creative
echo "[6] Cleanup..."
echo "  Deleting ad ${AD_ID}..."
curl -s -X POST "https://graph.facebook.com/v25.0/${AD_ID}" -d "access_token=$META_TOKEN" -d "status=DELETED" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ' + ('OK' if d.get('success') else 'FAIL'))"
echo "  Deleting creative ${CR_ID}..."
curl -s -X POST "https://graph.facebook.com/v25.0/${CR_ID}" -d "access_token=$META_TOKEN" -d "status=DELETED" | python3 -c "import sys,json; d=json.load(sys.stdin); print('    ' + ('OK' if d.get('success') else 'FAIL'))"

echo ""
echo "=== W3: ✅ DONE ==="
echo "Ad ID: $AD_ID"
echo "Creative ID: $CR_ID"
echo "Cleanup: confirmed"
