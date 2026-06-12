# Research Brief: Meta Ads Manager Structure → MAPI v25 Field Mapping

**Author:** Fable 5 · **Executor:** Sonnet (riset docs, BUKAN coding) · **Konsumen hasil:** Fable 5 (blueprint v2)
**Tanggal:** 2026-06-12

## Misi

Wizard test-launches kita salah penataan: audience/placement/page+IG sekarang campaign-level, padahal di Meta Ads Manager itu **adset-level** (audience, placement) dan **ad-level** (identity Page+IG). Sebelum re-arsitektur, kumpulkan kontrak API yang presisi untuk SEMUA field di bawah.

**Output:** SATU file `docs/blueprints/abo-research-results.md`. JANGAN coding, JANGAN ubah file lain, JANGAN migration. Riset murni.

## Aturan riset

1. Sumber utama: `developers.facebook.com/docs/marketing-api/...` — versi **v25.0**. Docs Meta sering truncated/minta login; kalau gagal, coba: (a) URL reference langsung per object, (b) facebook-business-sdk GitHub (python/node) sebagai sumber field enum, (c) web search dengan quote nama field.
2. Untuk SETIAP item jawab dalam format tabel ini — tanpa kecuali:

| Field API | Level (campaign/adset/ad/creative) | Type | Enum/format | Required when | Catatan v25 | Source URL | Confidence (verified/inferred) |

3. **JANGAN ngarang.** Kalau nggak ketemu di docs/SDK → tulis `confidence: NOT_FOUND` + apa yang dicoba. NOT_FOUND yang jujur lebih berguna daripada tebakan.
4. `verified` = baca langsung dari docs/SDK source. `inferred` = dari artikel pihak ketiga/pattern SDK. Bedakan tegas.
5. Setiap section ada subsection **"Bahasa bayi"**: penjelasan 1-2 kalimat per field untuk tooltip UI (Indonesia santai, user awam ads ngerti).

---

## Item Riset

### R1. Budget sharing antar adset (ABO)
Ads Manager: toggle "Share some of your budget with other ad sets" — kita mau ini **MATI** saat ABO.
- Cari field API-nya di campaign atau adset (mulai dari `developers.facebook.com/docs/marketing-api/bidding/guides/adset-budget-sharing/`).
- Apa default-nya? Cara explicit disable saat create? Apa nama field exact-nya?

### R2. Conversion location (adset)
Ads Manager step adset: Website / App / Message destination / dst.
- Field `destination_type` di adset — enum lengkap v25 (WEBSITE, APP, MESSENGER, WHATSAPP, ON_AD, PHONE_CALL, ...?).
- Relasi dengan `promoted_object` dan `optimization_goal` — kombinasi mana yang valid per objective (OUTCOME_LEADS / OUTCOME_SALES / OUTCOME_TRAFFIC)? Bikin matriks objective × destination_type → optimization_goal + billing_event yang valid.

### R3. CPR goal / Cost per result goal (adset)
- Di Ads Manager muncul kondisional. Kapan nyala? (hipotesis: bid_strategy COST_CAP → `bid_amount`; konfirmasi).
- Field exact: `bid_amount`? satuan minor units? Di adset atau campaign saat CBO vs ABO?
- `bid_constraints.roas_average_floor` untuk MIN_ROAS — format & contoh.

### R4. Attribution setting (adset)
- Field `attribution_spec`: format array `[{event_type, window_days}]` — enum event_type, window_days yang diizinkan v25 (1-day click, 7-day click, 1-day view, dst).
- Default kalau tidak dikirim?
- Bahasa bayi WAJIB bagus di sini (user paling bingung di attribution).

### R5. Dataset / Pixel (adset)
- `promoted_object`: `{pixel_id, custom_event_type}` — enum custom_event_type yang umum (PURCHASE, LEAD, ADD_TO_CART, COMPLETE_REGISTRATION...).
- Kapan wajib? (per objective/destination_type).
- "Dataset" vs "Pixel" di v25 — istilah baru? endpoint list pixels per ad account (kita sudah hardcode PIXEL_OPTIONS — cari endpoint dinamisnya: `act_{id}/adspixels`? fields?).

### R6. Schedule (adset)
- `start_time` / `end_time` format ISO8601 + timezone behavior (pakai timezone ad account?).
- Start "sekarang": omit start_time atau kirim now? `end_time` optional kalau daily_budget?
- Dayparting `adset_schedule` — ada di v25? syarat (lifetime budget only?). Kalau ribet, cukup catat ada/tidaknya — kita mungkin out-of-scope-kan.

### R7. Custom audiences include/exclude (adset)
- `targeting.custom_audiences` / `targeting.excluded_custom_audiences` — format `[{id}]`?
- Konfirmasi (fitur kita sudah ada, pastikan field name benar di v25).

### R8. Detailed targeting (adset)
- `targeting.flexible_spec` — struktur `[{interests:[{id,name}], behaviors:[...], demographics?...}]`, AND/OR semantics antar elemen.
- `targeting.exclusions` — struktur.
- Endpoint search: `search?type=adinterest&q=...` atau `act_{id}/targetingsearch`? — endpoint mana yang hidup di v25, params, response shape. (Ini buat autocomplete UI — pattern sama kayak adgeolocation kita yang sudah jalan.)
- `targeting_optimization` / Advantage detailed targeting flag — nama field & default v25.

### R9. Devices & OS (adset)
- `targeting.device_platforms` (mobile/desktop), `targeting.user_os` (iOS/Android + version syntax `'iOS_ver_14.0_and_above'`?), `targeting.user_device` — enum & format.

### R10. Platform & positions (adset)
- `targeting.publisher_platforms`, `facebook_positions`, `instagram_positions`, `messenger_positions`, `audience_network_positions` — enum LENGKAP v25 per platform.
- Cross-check dengan PLACEMENT_OPTIONS kita di `src/app/test-launches/new/page.tsx` (19 entries) — tandai yang salah nama/deprecated/kurang.
- Advantage+ placements (automatic) = omit semua fields ini? konfirmasi.

### R11. Identity Page + Instagram (AD level)
- Di creative `object_story_spec.page_id` + field IG: `instagram_actor_id` vs `instagram_user_id` — mana yang v25? (ada deprecation history di sini, teliti).
- Bisa beda identity antar ad dalam 1 adset? (harusnya bisa — konfirmasi).
- Endpoint list IG accounts linked ke page (kita sudah punya pages+IG di MetaPage model — cukup konfirmasi field creative-nya).

### R12. Creative: single image vs carousel (ad/creative)
- Single: `object_story_spec.link_data {link, message, name, description, image_hash, call_to_action {type, value:{link}}}`.
- Carousel: `link_data.child_attachments [{link, image_hash, name, description, call_to_action}]` — min/max cards, field per card.
- Video: `video_data {video_id, image_url thumbnail, title, message, call_to_action}`.
- Upload: `act_{id}/adimages` (return image_hash) & `act_{id}/advideos` (chunked? simple?) — params, dari URL bisa? (`url` param di adimages?).

### R13. Tracking (ad)
- `url_tags` di ad object (format `utm_source=...&utm_medium=...`) vs `tracking_specs` — mana yang dipakai untuk UTM, default behavior.
- Pixel tracking di ad level otomatis dari promoted_object adset atau perlu `tracking_specs` eksplisit?

### R14. Validasi lintas-level (penting buat zero-error)
- CBO: campaign `daily_budget` + adset TANPA budget — konfirmasi error kalau dua-duanya (kita sudah implement, konfirmasi aja).
- ABO: adset `daily_budget` minimum per currency — ada docs resmi minimum IDR? Kalau ada angka resmi, kutip + URL. Kalau tidak, catat NOT_FOUND.
- Field campaign yang WAJIB v25: `special_ad_categories` (wajib walau kosong `[]`?), `buying_type`.
- Urutan create yang benar + bisa batch? (`act_{id}/asyncadrequestsets` atau sequential campaign→adset→creative→ad).

### R15. Struktur Ads Manager aktual (cross-check macro framework)
Rangkum urutan field yang Ads Manager tampilkan saat create campaign ABO (sumber: docs "Ads Manager campaign structure" / artikel 2025-2026 yang kredibel):
- Campaign level: apa saja
- Adset level: apa saja (urutannya)
- Ad level: apa saja (urutannya)
Tujuan: jadi acuan urutan step wizard v2. Tandai item yang user kita sebut tapi TIDAK ketemu di API (berarti UI-only Ads Manager).

---

## Format file hasil

```markdown
# Research Results: MAPI v25 Field Mapping
Tanggal riset: ... · Executor: Sonnet

## R1. Budget sharing
| Field API | Level | Type | Enum/format | Required when | Catatan v25 | Source | Confidence |
|---|---|---|---|---|---|---|---|
...
**Bahasa bayi:** ...
**Catatan implementasi:** ...

## R2. ...
(dst semua R1-R15)

## Daftar NOT_FOUND
- Rxx item Y: dicoba [url1, url2], hasil: ...

## Ringkasan koreksi vs implementasi existing
- PLACEMENT_OPTIONS: [yang salah/deprecated]
- audienceJson schema: [yang perlu berubah]
- ...
```

## Definition of Done (Sonnet)

- [ ] 15 section terisi format tabel + bahasa bayi
- [ ] Tiap row punya Source URL + confidence
- [ ] Zero coding/migration/perubahan file lain
- [ ] NOT_FOUND list jujur
- [ ] Commit 1x: `research: MAPI v25 field mapping for ABO wizard v2` — file results only
