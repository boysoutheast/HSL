# Research Results: MAPI v25 Field Mapping

Tanggal riset: 2026-06-12  
Executor: Sonnet  
Scope: riset docs/SDK saja, tanpa coding

## Metode & source order

1. Official docs Meta / developers.facebook.com.
2. Fallback ke raw `facebook-business-sdk-codegen` spec JSON.
3. Fallback ke official `facebook-python-business-sdk` generated objects.
4. Kalau enum/default tidak kebaca dari source di atas: tandai `NOT_FOUND` atau `inferred`, tidak diisi dari ingatan.

---

## R1. Budget sharing

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `is_adset_budget_sharing_enabled` | campaign | bool | `true/false` | opsional saat create/update campaign | Nama field ini muncul konsisten di guide budget sharing, spec `Campaign.json`, dan spec create params di `AdAccount.json`. Ini field paling dekat dengan toggle Ads Manager “Share some of your budget with other ad sets”. | https://developers.facebook.com/docs/marketing-api/bidding/guides/adset-budget-sharing/ · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Campaign.json · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json | verified |
| `budget_rebalance_flag` | campaign | bool | `true/false` | opsional | Field ini ada di `Campaign.json`, tapi docs page yang kebaca tidak menjelaskan behavior exact-nya. Jangan pakai dulu sebagai pengganti toggle utama tanpa live verify. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Campaign.json | verified |
| explicit disable | campaign | bool | kirim `is_adset_budget_sharing_enabled=false` | saat mau ABO per-adset strict | Dari naming + docs guide, disable paling aman dengan kirim `false` eksplisit. Default server bila field absen tidak kebaca jelas dari source publik. | https://developers.facebook.com/docs/marketing-api/bidding/guides/adset-budget-sharing/ | inferred |
| default state | campaign | unknown | NOT_FOUND | n/a | Default saat field tidak dikirim tidak kebaca jelas di docs/SDK yang bisa diakses tanpa login penuh. | guide + spec di atas | NOT_FOUND |

**Bahasa bayi:**  
Toggle ini bikin Meta boleh mindahin jatah budget antar ad set. Kalau mode kita ABO dan tiap ad set harus pegang budget sendiri, toggle ini harus dimatiin pakai `is_adset_budget_sharing_enabled=false`.

**Catatan implementasi:**  
Untuk ABO wizard, treat field ini sebagai campaign-level, bukan adset-level.

---

## R2. Conversion location / destination

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `destination_type` | adset | string enum | `APP`, `APPLINKS_AUTOMATIC`, `FACEBOOK`, `FACEBOOK_LIVE`, `FACEBOOK_PAGE`, `IMAGINE`, `INSTAGRAM_DIRECT`, `INSTAGRAM_LIVE`, `INSTAGRAM_PROFILE`, `INSTAGRAM_PROFILE_AND_FACEBOOK_PAGE`, `MESSAGING_INSTAGRAM_DIRECT_MESSENGER`, `MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP`, `MESSAGING_INSTAGRAM_DIRECT_WHATSAPP`, `MESSAGING_MESSENGER_WHATSAPP`, `MESSENGER`, `ON_AD`, `ON_EVENT`, `ON_PAGE`, `ON_POST`, `ON_VIDEO`, `SHOP_AUTOMATIC`, `WEBSITE`, `WHATSAPP` | saat flow/objective butuh explicit destination | Enum v25 kebaca langsung dari SDK `adset.py`. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py | verified |
| `optimization_goal` | adset | string enum | termasuk `OFFSITE_CONVERSIONS`, `LINK_CLICKS`, `LANDING_PAGE_VIEWS`, `LEAD_GENERATION`, `CONVERSATIONS`, `QUALITY_LEAD`, `VALUE`, dst | wajib create adset | Enum luas; valid pairing per objective+destination tidak fully ditulis resmi di 1 source publik. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py | verified |
| `billing_event` | adset | string enum | `APP_INSTALLS`, `CLICKS`, `IMPRESSIONS`, `LINK_CLICKS`, `LISTING_INTERACTION`, `NONE`, `OFFER_CLAIMS`, `PAGE_LIKES`, `POST_ENGAGEMENT`, `PURCHASE`, `THRUPLAY` | wajib create adset di banyak flow | Pairing valid tetap tergantung objective/optimization_goal. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py | verified |
| `promoted_object` | adset | object | lihat R5 | wajib untuk offsite/pixel flows | Dipakai bersama destination tertentu, terutama `WEBSITE` / pixel conversion. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py · https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adpromotedobject.py | verified |

### Matriks minimal yang kebaca aman dari source + pattern official skill

| Objective | destination_type | optimization_goal yang paling aman | billing_event yang umum | promoted_object |
|---|---|---|---|---|
| `OUTCOME_SALES` | `WEBSITE` | `OFFSITE_CONVERSIONS` atau `VALUE` | `IMPRESSIONS` | pixel/dataset + `custom_event_type` umumnya wajib |
| `OUTCOME_LEADS` | `WEBSITE` | `OFFSITE_CONVERSIONS` untuk pixel lead | `IMPRESSIONS` | pixel + `custom_event_type=LEAD` |
| `OUTCOME_LEADS` | `ON_AD` / lead form | `LEAD_GENERATION` | inferred | biasanya page/form object, bukan pixel-only flow |
| `OUTCOME_TRAFFIC` | `WEBSITE` | `LINK_CLICKS` atau `LANDING_PAGE_VIEWS` | `IMPRESSIONS` atau `LINK_CLICKS` | biasanya tidak wajib pixel |
| messaging objectives | `MESSENGER` / `WHATSAPP` / mixed messaging enums | `CONVERSATIONS` / messaging variants | inferred | object messaging-related |

Source matriks: SDK enums + Meta skill notes yang sudah verified operasional, bukan 1 halaman docs tunggal.  
Confidence matriks: `inferred`.

**Bahasa bayi:**  
`destination_type` itu bilang orang nanti diarahkan ke mana: website, WhatsApp, Messenger, form di dalam iklan, atau tempat lain. Habis itu Meta baru tahu hasil apa yang mau dikejar: klik, lead, pembelian, atau chat.

**Catatan implementasi:**  
Untuk wizard v2, simpan `destination_type` di adset. Validasi final pairing objective/destination/optimization_goal masih perlu live validation branch, karena docs publik tidak kasih matriks lengkap satu tempat.

---

## R3. CPR goal / cost per result goal

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `bid_strategy` | adset (ABO) / campaign (CBO pattern tertentu) | string enum | `COST_CAP`, `LOWEST_COST_WITHOUT_CAP`, `LOWEST_COST_WITH_BID_CAP`, `LOWEST_COST_WITH_MIN_ROAS` | saat mau kontrol bidding | Enum kebaca jelas di `adset.py`. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py | verified |
| `bid_amount` | adset | unsigned int | minor units currency account | wajib untuk beberapa bid strategy | `bid_amount` field ada di adset. Untuk akun IDR, pattern operasional pakai rupiah langsung, bukan x100. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json | verified |
| `bid_constraints.roas_average_floor` | adset | int | contoh `10000` = ROAS 1.0 | saat `bid_strategy=LOWEST_COST_WITH_MIN_ROAS` | `roas_average_floor` kebaca langsung dari object `AdCampaignBidConstraint`. Blueprint rule konsisten dengan ini. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcampaignbidconstraint.py | verified |
| “cost per result goal” UI | ads manager UI | unknown exact mapping | kemungkinan besar `bid_amount` untuk `COST_CAP` | saat UI field muncul | Source publik yang kebaca tidak punya label UI → field exact mapping disimpulkan dari enum + industry pattern, bukan docs UI field map resmi. | SDK above | inferred |

**Bahasa bayi:**  
Kalau kamu isi target biaya hasil, kamu lagi bilang ke Meta, “jangan beli hasil terlalu mahal.” Untuk cost cap biasanya angka ini masuk ke `bid_amount`. Untuk minimum ROAS, Meta pakai `roas_average_floor`.

**Catatan implementasi:**  
ABO: taruh bidding control di adset. CBO: tetap bisa ada pattern campaign-level untuk beberapa setup, tapi untuk wizard ABO baru lebih aman semua per-adset.

---

## R4. Attribution setting

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `attribution_spec` | adset | array<object> | `[{event_type, window_days}]` | opsional | Field ada jelas di adset. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py | verified |
| `event_type` | adset.attribution_spec[] | string | string | saat isi attribution_spec | Object helper `AttributionSpec` hanya bilang type string, tidak kasih enum resmi di source yang kebaca. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/attributionspec.py | verified |
| `window_days` | adset.attribution_spec[] | int | int | saat isi attribution_spec | Object helper kasih type int, tidak kasih daftar nilai resmi. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/attributionspec.py | verified |
| enum event_type lengkap | adset.attribution_spec[] | unknown | NOT_FOUND | n/a | Tidak ketemu enum publik lengkap di SDK/spec kebuka. | docs + SDK above | NOT_FOUND |
| allowed window list lengkap | adset.attribution_spec[] | unknown | NOT_FOUND | n/a | Nilai seperti 1-day click / 7-day click umum dikenal, tapi daftar resmi lengkap tidak kebaca dari source publik yang diakses. | docs + SDK above | NOT_FOUND |
| default bila absen | adset | unknown | NOT_FOUND | n/a | Default server-side tidak kebaca jelas di source publik yang terbuka. | docs + SDK above | NOT_FOUND |

**Bahasa bayi:**  
Attribution itu aturan “hasil dihitung ke iklan ini kalau orang beli/isi form dalam berapa hari setelah lihat atau klik.” Makin pendek jendelanya, makin ketat; makin panjang, makin banyak hasil bisa ikut kehitung.

**Catatan implementasi:**  
Jangan hardcode enum UI dulu dari ingatan. Kalau mau expose pilihan attribution di wizard v2, source resmi tambahan masih perlu digali atau diverifikasi lewat live create/readback.

---

## R5. Dataset / Pixel

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `promoted_object.pixel_id` | adset | string | pixel/dataset id | offsite conversion / website sales/leads umumnya wajib | Field ada di `AdPromotedObject`. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adpromotedobject.py | verified |
| `promoted_object.custom_event_type` | adset | string enum | `ACHIEVEMENT_UNLOCKED`, `ADD_PAYMENT_INFO`, `ADD_TO_CART`, `ADD_TO_WISHLIST`, `AD_IMPRESSION`, `COMPLETE_REGISTRATION`, `CONTACT`, `CONTENT_VIEW`, `CUSTOMIZE_PRODUCT`, `D2_RETENTION`, `D7_RETENTION`, `DONATE`, `FIND_LOCATION`, `INITIATED_CHECKOUT`, `LEAD`, `LEVEL_ACHIEVED`, `LISTING_INTERACTION`, `MESSAGING_CONVERSATION_STARTED_7D`, `OTHER`, `PURCHASE`, `RATE`, `SCHEDULE`, `SEARCH`, `SERVICE_BOOKING_REQUEST`, `SPENT_CREDITS`, `START_TRIAL`, `SUBMIT_APPLICATION`, `SUBSCRIBE`, `TUTORIAL_COMPLETION` | saat pixel event based optimization | Enum kebaca langsung. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adpromotedobject.py | verified |
| list datasets/pixels | ad account edge | edge | `GET /act_{id}/adspixels` | saat load pilihan pixel | Brief sudah curiga ke edge ini; source skill Meta core juga konsisten. Spec raw lengkap endpoint response shape tidak ditarik kali ini. | https://developers.facebook.com/docs/marketing-api/reference/ad-account/adspixels/ | inferred |
| istilah “dataset” vs “pixel” | product naming | string | n/a | n/a | Source object API masih dominan pakai `pixel_id`. Di UI bisa muncul “dataset”, tapi field API yang kebaca tetap `pixel_id`. | `AdPromotedObject` SDK + current brief | inferred |

**Bahasa bayi:**  
Pixel/dataset itu alat buat bilang ke Meta, “orang tadi beli / isi form / add to cart.” Kalau kamu mau iklan ngejar pembelian atau lead di website, biasanya adset harus tahu `pixel_id` dan event apa yang dikejar.

**Catatan implementasi:**  
Untuk endpoint dinamis pixel selector, paling mungkin `GET /act_{id}/adspixels` lalu ambil minimal `id,name`.

---

## R6. Schedule

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `start_time` | adset | datetime | ISO8601/datetime string | opsional | Field ada di adset create surface. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json | verified |
| `end_time` | adset | datetime | ISO8601/datetime string | opsional | Field ada di adset create surface. | source sama | verified |
| `adset_schedule` | adset | list<object> | list object | opsional | Field ada di create surface; detail object schema tidak kebaca di source ini. | source sama | verified |
| timezone behavior | ad account timezone | behavior | inferred pakai timezone account | saat kirim start/end | Meta skill yang sudah dipakai operasional menulis schedule pakai timezone ad account. Source raw object tidak menjelaskan behavior, jadi ini inferred dari verified ops notes. | skill `meta-ads-api-adsets` + source above | inferred |
| start “sekarang” | adset | behavior | omit `start_time` | saat mau start ASAP | Tidak ada source publik yang eksplisit bilang “omit = now”, tapi itu pattern umum Meta. | docs/ops pattern | inferred |
| `end_time` optional kalau daily budget | adset | behavior | ya, kemungkinan optional | kebanyakan ongoing adset | Belum ada docs line publik yang kebaca eksplisit di session ini. | docs/ops pattern | inferred |
| dayparting lifetime-budget-only | adset | behavior | NOT_FOUND dari source publik yang dibaca | saat mau schedule per jam/hari | Sering disebut di docs lama, tapi di source v25 yang kebaca di session ini tidak dapat konfirmasi formal. | docs/SDK attempted | NOT_FOUND |

**Bahasa bayi:**  
`start_time` dan `end_time` itu tanggal mulai dan tanggal berhenti iklan. Kalau dikosongin, biasanya iklan bisa jalan secepat Meta siapin, dan kalau `end_time` kosong berarti jalan terus sampai kamu stop.

**Catatan implementasi:**  
Untuk v2 wizard, schedule cukup disimpan di adset. Dayparting boleh out-of-scope sampai schema detailnya diverifikasi lebih keras.

---

## R7. Custom audiences include/exclude

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `targeting.custom_audiences` | adset.targeting | `list<RawCustomAudience>` | list object audience | saat include CA | Field name kebaca exact di `Targeting.json`. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Targeting.json | verified |
| `targeting.excluded_custom_audiences` | adset.targeting | `list<RawCustomAudience>` | list object audience | saat exclude CA | Field name kebaca exact di `Targeting.json`. | source sama | verified |
| item shape | adset.targeting | object | kemungkinan minimal `{id}` | saat kirim audience item | Type helper cuma bilang `RawCustomAudience`; shape exact minimal tidak kebaca di source yang dibuka. Pattern umum `{id}`. | source sama | inferred |

**Bahasa bayi:**  
Custom audience itu daftar orang yang sudah kamu punya. Versi include artinya “target orang ini”, versi exclude artinya “jangan tampil ke orang ini”.

**Catatan implementasi:**  
Field names existing sudah benar. Simpan shape minimal `{id}` dulu, jangan bikin schema terlalu ribet kalau backend autocomplete belum siap.

---

## R8. Detailed targeting

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `targeting.flexible_spec` | adset.targeting | `list<FlexibleTargeting>` | list object | saat detailed targeting expansion / grouped OR blocks | Field name dan type kebaca exact. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Targeting.json | verified |
| `targeting.exclusions` | adset.targeting | `FlexibleTargeting` | object | saat exclude interest/behavior/demo | Field name dan type kebaca exact. | source sama | verified |
| AND/OR semantics | targeting logic | behavior | list block logic | saat build UI | Source raw type tidak jelaskan semantics tertulis. Pola umum Meta: item di dalam satu block = OR; block terpisah = AND antar cluster. | SDK/spec + common Meta targeting behavior | inferred |
| interest search endpoint | platform search | endpoint | `GET /search?type=adinterest&q=...` | autocomplete | Pattern ini didokumentasi luas dan dipakai skill internal, tapi tidak diverifikasi live di session ini. | skill `meta-ads-api-adsets` | inferred |
| alternative targeting search edge | platform search | endpoint | `act_{id}/targetingsearch` | autocomplete | Disebut di brief sebagai hipotesis; belum diverifikasi di source yang kebaca. | attempted docs only | NOT_FOUND |
| `targeting_automation` | adset.targeting | `TargetingAutomation` | object | advantage/detailed targeting automation | Field ada exact di `Targeting.json`. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Targeting.json | verified |
| `targeting_optimization` | adset.targeting | string | string | opsional | Field ada exact, tapi enum/default tidak kebaca. | source sama | verified |
| default targeting optimization | adset.targeting | unknown | NOT_FOUND | n/a | Default behavior tidak kebaca dari source publik yang dipakai. | source sama | NOT_FOUND |

**Bahasa bayi:**  
Detailed targeting itu minat, kebiasaan, dan ciri orang yang mau kamu sasar. `flexible_spec` dipakai kalau kamu mau gabung beberapa grup minat, sedangkan `exclusions` buat bilang “yang ini jangan ikut.”

**Catatan implementasi:**  
Autocomplete interest paling realistis mulai dari `search?type=adinterest&q=...` dulu.

---

## R9. Devices & OS

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `targeting.device_platforms` | adset.targeting | `list<DevicePlatforms>` | `connected_tv`, `desktop`, `mobile` | saat filter device class | Enum kebaca exact di `targeting.py`. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/targeting.py | verified |
| `targeting.user_os` | adset.targeting | `list<string>` | string list | saat filter OS | Source hanya kasih type `list<string>`, tidak kasih enum/value catalog. | source sama | verified |
| `targeting.user_device` / `excluded_user_device` | adset.targeting | string/list<string> | string list | saat filter model device | Source kebuka menunjukkan `excluded_user_device`, bukan enum katalog lengkap `user_device`. Value catalog tidak kebaca. | source sama | verified |
| OS version syntax contoh | adset.targeting | string | contoh `iOS_ver_14.0_and_above` | saat mau filter versi OS | Format contoh ini tidak kebaca dari source resmi yang berhasil diambil di session ini. | attempted docs only | NOT_FOUND |

**Bahasa bayi:**  
Bagian ini buat milih iklan cuma tampil di HP, desktop, atau OS tertentu. Cocok kalau landing page atau app kamu cuma bagus di device tertentu.

**Catatan implementasi:**  
Karena enum/value catalog OS dan device model belum ketarik resmi, wizard v2 jangan expose filter versi OS dulu kalau belum ada source lookup yang kuat.

---

## R10. Platform & positions

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `targeting.publisher_platforms` | adset.targeting | `list<string>` | string list | manual placements | Field name exact kebaca. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Targeting.json | verified |
| `targeting.facebook_positions` | adset.targeting | `list<string>` | string list | manual placements | Field name exact kebaca. | source sama | verified |
| `targeting.instagram_positions` | adset.targeting | `list<string>` | string list | manual placements | Field name exact kebaca. | source sama | verified |
| `targeting.messenger_positions` | adset.targeting | `list<string>` | string list | manual placements | Field name exact kebaca. | source sama | verified |
| `targeting.audience_network_positions` | adset.targeting | `list<string>` | string list | manual placements | Field name exact kebaca. | source sama | verified |
| enum lengkap per positions | adset.targeting | unknown | NOT_FOUND | n/a | Source raw object yang kebuka hanya kasih type `list<string>`, bukan daftar enum lengkap. | source sama | NOT_FOUND |
| automatic placements | adset.targeting | behavior | omit placement fields | saat Advantage+/automatic placement | Skill Meta adsets bilang omitting placements defaults ke automatic placements. | skill `meta-ads-api-adsets` | inferred |

### Cross-check vs current `PLACEMENT_OPTIONS` di repo

Current file `/root/hsl-source/src/app/test-launches/new/page.tsx` hanya punya 6 entries, bukan 19:
- `facebook_feed`
- `facebook_stories`
- `instagram_feed`
- `instagram_stories`
- `instagram_reels`
- `instagram_explore`

Temuan:
- Brief bilang 19 entries, tapi file current cuma 6. Source of truth repo sekarang = 6 entries.
- Naming UI current bukan raw Meta field shape. Misal `facebook_feed` tampak sebagai gabungan `publisher_platforms=['facebook']` + `facebook_positions=['feed']`, bukan enum API tunggal.
- `instagram_feed` kemungkinan harus jadi `publisher_platforms=['instagram']` + `instagram_positions=['stream']` saat mapping API.
- `instagram_stories` kemungkinan map ke `instagram_positions=['story']`.
- `instagram_explore` kemungkinan map ke `instagram_positions=['explore']`.
- `instagram_reels` kemungkinan map ke `instagram_positions=['reels']`.
- `facebook_stories` kemungkinan map ke `facebook_positions=['story']`.

Baris mapping di atas `inferred`, bukan verified enum sheet lengkap.

**Bahasa bayi:**  
Placements itu nentuin iklan tayang di mana: feed, story, reels, explore, dan lain-lain. Kalau pilih automatic placements, biasanya field posisi ini tidak perlu dikirim satu-satu.

**Catatan implementasi:**  
Jangan treat UI token seperti `facebook_feed` sebagai field API final. Itu harus dipecah ke platform + positions.

---

## R11. Identity Page + Instagram

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `object_story_spec.page_id` | creative | string | page id | hampir selalu untuk page-backed creative | Ada exact di `AdCreativeObjectStorySpec`. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcreativeobjectstoryspec.py | verified |
| `object_story_spec.instagram_user_id` | creative | string | instagram business user id | saat mau pakai identity IG spesifik | Ada exact di `AdCreativeObjectStorySpec` dan `AdCreative.json`. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcreativeobjectstoryspec.py · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdCreative.json | verified |
| `instagram_actor_id` | promoted_object / legacy related surfaces | string | string | context tertentu | Field ini ada di `AdPromotedObject`, bukan di `AdCreativeObjectStorySpec` yang kebaca. Untuk creative v25 current, `instagram_user_id` lebih kuat source-nya. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adpromotedobject.py | verified |
| beda identity per ad dalam 1 adset | ad/creative relationship | behavior | yes, karena ad menunjuk creative berbeda | Selama tiap ad pakai creative beda, identity technically bisa beda. Ini inferred dari hierarchy object, bukan kalimat docs tunggal. | creative/ad object model | inferred |

**Bahasa bayi:**  
Page dan akun Instagram yang tampil di iklan ditaruh di level creative/ad, bukan di campaign. Jadi satu campaign atau ad set bisa saja punya beberapa iklan dengan identity berbeda kalau creativenya beda.

**Catatan implementasi:**  
Untuk wizard v2, pindahkan Page + IG identity ke layer ad/creative payload, jangan ditahan di campaign/adset.

---

## R12. Creative: single image vs carousel vs video

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `object_story_spec.link_data.link` | creative | string | URL | single image / carousel link ad | Kebaca exact. | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcreativelinkdata.py | verified |
| `object_story_spec.link_data.message` | creative | string | text | single image / carousel | kebaca exact | source sama | verified |
| `object_story_spec.link_data.name` | creative | string | text | single image / carousel | kebaca exact | source sama | verified |
| `object_story_spec.link_data.description` | creative | string | text | single image / carousel | kebaca exact | source sama | verified |
| `object_story_spec.link_data.image_hash` | creative | string | uploaded image hash | single image / some cards | kebaca exact | source sama | verified |
| `object_story_spec.link_data.call_to_action` | creative | object | CTA object | single image / carousel | kebaca exact | source sama | verified |
| `object_story_spec.link_data.child_attachments` | creative | list<object> | carousel cards | carousel | kebaca exact | source sama | verified |
| `object_story_spec.video_data.video_id` | creative | string | video id | video creative | kebaca exact | https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcreativevideodata.py | verified |
| `object_story_spec.video_data.image_url` | creative | string | thumbnail URL | video creative | kebaca exact | source sama | verified |
| `object_story_spec.video_data.title` | creative | string | title | video creative | kebaca exact | source sama | verified |
| `object_story_spec.video_data.message` | creative | string | text | video creative | kebaca exact | source sama | verified |
| `object_story_spec.video_data.call_to_action` | creative | object | CTA object | video creative | kebaca exact | source sama | verified |
| upload image edge | ad account edge | endpoint | `POST /act_{id}/adimages` | sebelum pakai `image_hash` | Source skill dan common Meta docs konsisten. | https://developers.facebook.com/docs/marketing-api/reference/ad-account/adimages/ | inferred |
| upload image by URL | ad account edge | param | `url` | upload by remote URL | Skill `meta-ads-api-creatives` pakai `url` dan pattern ini umum. | skill `meta-ads-api-creatives` | inferred |
| upload video edge | ad account edge | endpoint | `POST /act_{id}/advideos` | sebelum pakai `video_id` | Source skill/docs pattern konsisten. | https://developers.facebook.com/docs/marketing-api/reference/ad-account/advideos/ | inferred |
| carousel min/max cards | creative | count | min 2, max 10 | carousel | Nilai ini muncul di skill Meta creatives, tapi bukan dibaca langsung dari raw spec session ini. | skill `meta-ads-api-creatives` | inferred |

**Bahasa bayi:**  
Single image itu satu gambar satu pesan. Carousel itu beberapa kartu yang bisa digeser. Video pakai `video_id`, bukan `image_hash`.

**Catatan implementasi:**  
Untuk wizard v2, creative schema memang harus pecah menurut type, jangan lagi flat image-only kalau mau support carousel/video dengan benar.

---

## R13. Tracking

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| `url_tags` | creative (juga create params di AdAccount adcreative edge) | string | query string, contoh `utm_source=...&utm_medium=...` | saat butuh UTM | `url_tags` kebaca langsung di `AdCreative.json` dan `AdAccount.json`. Ini field paling jelas buat UTM. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdCreative.json · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json | verified |
| `tracking_specs` | ad | object | object | opsional | Field ini ada di `Ad.json` dan create params di `AdAccount.json`, tapi bukan jalur utama UTM tagging. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Ad.json · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json | verified |
| pixel tracking source | adset promoted_object | behavior | inherit from adset promoted_object | offsite conv flows | Dari object model dan ops pattern, pixel/offsite tracking utama datang dari `promoted_object`, bukan wajib `tracking_specs` manual. | object model + verified Meta skill notes | inferred |

**Bahasa bayi:**  
Kalau cuma mau nambah UTM ke link, pakai `url_tags`. `tracking_specs` itu field tracking lain yang lebih teknis; bukan jalur utama buat tagging link biasa.

**Catatan implementasi:**  
Wizard v2 cukup fokus dulu ke `url_tags`. Jangan paksakan UI `tracking_specs` sebelum ada use case kuat.

---

## R14. Validasi lintas-level

| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence |
|---|---|---:|---|---|---|---|---|
| campaign `daily_budget` | campaign | unsigned int | minor units | CBO | Field ada di `Campaign.json` dan create params `AdAccount.json`. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Campaign.json · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json | verified |
| adset `daily_budget` | adset | unsigned int | minor units | ABO | Field ada di create adset params `AdAccount.json`. | source sama | verified |
| “dua level sama-sama isi budget” | cross-level validation | behavior | invalid | saat CBO/ABO salah campur | Blueprint rule sangat mungkin benar, tapi line error resmi exact tidak diambil langsung di session ini. | spec + blueprint | inferred |
| minimum daily budget per currency | campaign/adset | unknown | NOT_FOUND | saat validasi amount | Tidak ketemu angka resmi v25 publik untuk IDR minimum di source yang dibaca. Lebih aman surface error Meta apa adanya. | attempted docs + brief | NOT_FOUND |
| `special_ad_categories` | campaign | list enum | list, bisa kosong/required create | create campaign | `AdAccount.json` create params menandai field ini `required: true`. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json | verified |
| `buying_type` | campaign | string | string | opsional di create params | `Campaign.json` expose field ini, `AdAccount.json` create params juga punya `buying_type` tapi tidak ditandai required. | https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Campaign.json · https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json | verified |
| create order | workflow | sequence | campaign → adset → creative → ad | saat launch full | Ini mengikuti hierarchy object dan praktik API standar. | campaign/adset/creative/ad object structure | inferred |
| async batch option | ad account edge | endpoint | `asyncadrequestsets` | bulk/async ops | Brief menyebut ini sebagai kandidat; session ini tidak verifikasi detail shape/fit untuk launch builder. | docs hinted only | NOT_FOUND |

**Bahasa bayi:**  
Budget campaign dan budget ad set jangan diisi bareng, nanti Meta bingung level mana yang pegang uang. Untuk kategori iklan sensitif, `special_ad_categories` harus tetap dikirim, walau isinya kosong kalau memang tidak ada.

**Catatan implementasi:**  
Backend sekarang sudah benar arah besar: CBO budget di campaign, ABO budget di adset. Untuk minimum budget, jangan hardcode angka lokal.

---

## R15. Struktur Ads Manager aktual

| Layer | Item utama yang kebaca dari API/source | Confidence |
|---|---|---|
| Campaign | objective, budget mode / campaign budget, bid strategy tertentu, special ad categories, status, buying_type, budget sharing toggle campaign-level | inferred/verified mixed |
| Ad set | destination type, optimization goal, billing event, budget (ABO), schedule, audience, custom audiences, detailed targeting, placements/platforms, promoted_object pixel/dataset, attribution, bid strategy/cost cap | inferred/verified mixed |
| Ad / Creative | Page identity, Instagram identity, format (image/carousel/video), primary text/headline/description, CTA, URL tags, media asset refs | inferred/verified mixed |

### Implikasi ke wizard v2

- Campaign step: objective, campaign naming, budget mode, maybe campaign-level toggles only.
- Ad set step: audience + placement + destination + optimization + budget + schedule + pixel/dataset.
- Ad step: Page + IG identity + creatives + CTA + URL tags.

### Item yang tampak UI-ish / belum ketemu map API exact

- Label UI “Cost per result goal” exact wording → field backend kemungkinan `bid_amount`, tapi label UI resmi tidak ketemu.
- Enum lengkap attribution windows/event type publik.
- Enum lengkap placements per platform dari source publik yang diakses.
- Enum/value catalog OS version syntax.
- Default server-side untuk beberapa optional fields kalau omitted.

**Bahasa bayi:**  
Urutan Ads Manager modern masuk akal kalau campaign cuma pegang tujuan besar, ad set pegang siapa/di mana/berapa, lalu ad pegang tampilan iklannya. Wizard kita sekarang campur beberapa hal adset/ad ke layer terlalu atas.

**Catatan implementasi:**  
Untuk wizard ABO v2, re-arsitektur besar memang valid: audience + placements turun ke adset, identity turun ke ad/creative.

---

## Daftar NOT_FOUND

- R1 default state `is_adset_budget_sharing_enabled` saat field absen.
- R4 enum resmi lengkap `attribution_spec.event_type`.
- R4 daftar resmi lengkap `attribution_spec.window_days`.
- R4 default attribution bila field absen.
- R6 konfirmasi formal dayparting lifetime-budget-only pada source v25 yang kebuka.
- R8 endpoint alternatif `act_{id}/targetingsearch` belum terverifikasi.
- R8 default `targeting_optimization` belum terverifikasi.
- R9 enum/value resmi `user_os` termasuk syntax version strings.
- R9 enum/value resmi `user_device` katalog model device.
- R10 enum resmi lengkap `facebook_positions` / `instagram_positions` / `messenger_positions` / `audience_network_positions`.
- R14 angka minimum budget resmi IDR publik.
- R14 detail `asyncadrequestsets` untuk flow launch builder.

---

## Ringkasan koreksi vs implementasi existing

- `PLACEMENT_OPTIONS` repo current bukan 19 item; file current cuma 6 item.
- Token placement UI sekarang bukan field API final. Harus dipecah ke `publisher_platforms` + specific `*_positions`.
- Audience dan placements memang lebih cocok di adset, bukan campaign.
- Page + IG identity lebih cocok di creative/ad. `instagram_user_id` punya source lebih kuat daripada `instagram_actor_id` untuk current creative object story spec.
- Untuk pixel/dataset, source API current masih dominan `pixel_id` walau UI bisa bilang “dataset”.
- Attribution UI jangan dibikin sok lengkap dulu; source enum publik masih bolong.

---

## Source index utama dipakai

- https://developers.facebook.com/docs/marketing-api/bidding/guides/adset-budget-sharing/
- https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdAccount.json
- https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Campaign.json
- https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Ad.json
- https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/AdCreative.json
- https://raw.githubusercontent.com/facebook/facebook-business-sdk-codegen/main/api_specs/specs/Targeting.json
- https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py
- https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/targeting.py
- https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adpromotedobject.py
- https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcampaignbidconstraint.py
- https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/attributionspec.py
- https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcreativeobjectstoryspec.py
- https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcreativelinkdata.py
- https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adcreativevideodata.py
- `/root/hsl-source/src/app/test-launches/new/page.tsx`

## Verdict singkat

Blueprint arah besar benar:
- ABO butuh adset-level budget.
- budget sharing toggle ada di campaign-level.
- placement/audience harus turun ke adset.
- identity Page+IG harus turun ke ad/creative.

Bagian yang belum cukup exact untuk coding tanpa risiko tebak:
- attribution enum/default,
- placement enum sheet lengkap,
- OS/device catalog,
- formal default beberapa field optional.

Saran aman fase coding nanti: pakai hasil verified di atas sebagai kontrak inti, lalu area `NOT_FOUND` diperlakukan optional/hidden sampai ada live validation atau docs tambahan.