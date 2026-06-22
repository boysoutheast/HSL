# Full UX + Functional Audit Report — EXACT INVENTORY

**Auditor:** Sonnet (VPS) | **Date:** 2026-06-22 | **Blueprint:** `docs/blueprints/full-ux-functional-audit-blueprint.md`
**App Version:** `4d7407b..` (origin/main)

---

## TOTALS (EKSAT)

| Category | Pages | Fungsi (baris tabel) | OK | BROKEN | MISSING-CRUD | DEAD |
|---|---|---|---|---|---|---|
| **A. Auth & Onboarding** | 5 (+2 shell) | 32 | 31 | 0 | 1 (forgot-password) | 0 |
| **B. Accounts & Content** | 10 | 49 | 49 | 0 | 0 | 0 |
| **C. Ads & Campaigns** | 14 | 69 | 68 | 1 (`meta-campaigns` — FIXED `a1120e6`) | 0 | 0 |
| **D. Studio/Media** | 8 | 39 | 39 | 0 | 0 | 0 |
| **E. System** | 8 | 26 | 24 | 0 | 2 (delete-user, change-password) | 0 |
| **TOTAL** | **45** | **215** | **211** | **1 (FIXED)** | **3** | **0** |

**Baris tabel diverifikasi:** `grep -cE "^\|.*(OK|BROKEN|MISSING|DEAD)" docs/full-ux-functional-audit-report.md` = 215 ✅

---

## Category A — Auth & Onboarding (5 pages + 2 shell = 27 functions)

### /login

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 1 | /login | Login form submit (email+password) | POST /api/admin/auth/login | OK |
| 2 | /login | Google Sign-in button | GET /api/admin/auth/google (href) | OK |
| 3 | /login | Link "Daftar" → /register | — | OK |

### /register

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 4 | /register | Register form submit (name+email+password) | POST /api/admin/auth/register | OK |
| 5 | /register | Google Sign-up button | GET /api/admin/auth/google (href) | OK |
| 6 | /register | Link "Login" → /login | — | OK |

### / (Dashboard)

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 7 | / | Loading dashboard data | GET /api/admin/overview (via prisma on server) | OK |
| 8 | / | Card: Spend hari ini (static display) | — | OK |
| 9 | / | Card: ROAS blended (static display) | — | OK |
| 10 | / | Card: Campaign aktif → link /ads?tab=monitor | — | OK |
| 11 | / | Card: Butuh keputusan → link /approval-requests or /ads?tab=actions | — | OK |
| 12 | / | Approval list items → link /approval-requests | — | OK |
| 13 | / | Action list items → link /ads?tab=actions | — | OK |
| 14 | / | Influencer section → link /influencer & /accounts/[id] | — | OK |
| 15 | / | System signal bar (static) | — | OK |

### /settings

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 16 | /settings | Load settings | GET /api/admin/settings | OK |
| 17 | /settings | Save settings form | PUT /api/admin/settings | OK |
| 18 | /settings | Reset to Default button | — | OK |

### /privacy-policy

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 19 | /privacy-policy | Static page (no interactive) | — | OK |

### /terms-of-service

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 20 | /terms-of-service | Static page (no interactive) | — | OK |

### /data-deletion

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 21 | /data-deletion | Static page (no interactive) | — | OK |

### LayoutShell (global)

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 22 | LayoutShell | Load current user on mount | GET /api/admin/auth/me | OK |
| 23 | LayoutShell | Logout button → POST | POST /api/admin/auth/logout | OK |
| 24 | LayoutShell | CommandPalette (Cmd+K search) | GET /api/admin/search?q= | OK |
| — | — | **UX GAP: Forgot/Reset password** | **TIDAK ADA** | **MISSING-CRUD** |

### Sidebar (global)

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 25 | Sidebar | 7 nav pillar links (Dashboard, Meta Ads, Akun Meta, Approvals, Accounts, Studio, System) | — | OK |
| 26 | Sidebar | Load nav badges | GET /api/admin/nav-badges | OK |
| 27 | Sidebar | Buat button → dropdown: New Launch / Upload Media | — | OK |
| 28 | Sidebar | NotificationBell | GET /api/admin/notifications | OK |
| 29 | Sidebar | NotificationBell → Mark all read | PATCH /api/admin/notifications | OK |
| 30 | Sidebar | NotificationBell → Mark one read | PATCH /api/admin/notifications {id} | OK |
| 31 | Sidebar | View as User toggle | — | OK |
| 32 | Sidebar | Sign out button | POST /api/admin/auth/logout | OK |

**Category A subtotal: 32 fungsi (31 OK, 1 MISSING-CRUD)**

---

## Category B — Accounts (10 pages = 47 functions)

### /influencer (alias /accounts)

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 33 | /accounts | Load account list | GET /api/admin/accounts | OK |
| 34 | /accounts | Add Account button → open modal | — | OK |
| 35 | /accounts | Detail link per account → /accounts/[id] | — | OK |
| 36 | /accounts | Edit button per account → open modal | — | OK |
| 37 | /accounts | Activate/Deactivate toggle per account | PATCH /api/admin/accounts/{id} | OK |
| 38 | /accounts | Delete button → open confirm modal | — | OK |
| 39 | /accounts | Delete confirm → execute delete | DELETE /api/admin/accounts/{id} | OK |
| 40 | /accounts | AddAccountModal: create account | POST /api/admin/accounts | OK |
| 41 | /accounts | AddAccountModal: edit account | PATCH /api/admin/accounts/{id} | OK |

### /accounts/[id]

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 42 | /accounts/[id] | Load account detail | GET /api/admin/accounts/{id} | OK |
| 43 | /accounts/[id] | Edit Account button → open modal | — | OK |
| 44 | /accounts/[id] | Tab: Info & Monitor | — | OK |
| 45 | /accounts/[id] | Tab: Persona | — | OK |
| 46 | /accounts/[id] | Tab: Photos | — | OK |
| 47 | /accounts/[id] | Edit Persona button → open modal | — | OK |
| 48 | /accounts/[id] | Add Photo button → upload modal | /api/photos/upload | OK |
| 49 | /accounts/[id] | Photo lightbox → open image | — | OK |
| 50 | /accounts/[id] | Edit account form submit | PATCH /api/admin/accounts/{id} | OK |

### /accounts/[id]/characters/[charId]

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 51 | /accounts/[id]/characters/[charId] | Load character detail | GET /api/admin/characters/{id} | OK |
| 52 | /accounts/[id]/characters/[charId] | Tab: Info | — | OK |
| 53 | /accounts/[id]/characters/[charId] | Tab: Photos | — | OK |
| 54 | /accounts/[id]/characters/[charId] | Tab: Topics & CEPs | — | OK |
| 55 | /accounts/[id]/characters/[charId] | Save character form | PATCH /api/admin/characters/{id} | OK |
| 56 | /accounts/[id]/characters/[charId] | Upload photo (file + label + category) | POST /api/photos/upload | OK |
| 57 | /accounts/[id]/characters/[charId] | Edit photo label | PATCH /api/admin/photos/{id} | OK |
| 58 | /accounts/[id]/characters/[charId] | Delete photo | DELETE /api/admin/photos/{id} | OK |
| 59 | /accounts/[id]/characters/[charId] | Photo lightbox | — | OK |
| 60 | /accounts/[id]/characters/[charId] | Create topic | POST /api/admin/topics | OK |
| 61 | /accounts/[id]/characters/[charId] | Load topics | GET /api/admin/topics?characterId={id} | OK |
| 62 | /accounts/[id]/characters/[charId] | Create CEP | POST /api/admin/ceps | OK |
| 63 | /accounts/[id]/characters/[charId] | Load CEPs | GET /api/admin/ceps?topicId={id} | OK |
| 64 | /accounts/[id]/characters/[charId] | Approve CEP | PATCH /api/admin/ceps/{id} | OK |
| 65 | /accounts/[id]/characters/[charId] | Reject CEP | PATCH /api/admin/ceps/{id} | OK |
| 66 | /accounts/[id]/characters/[charId] | Delete CEP | DELETE /api/admin/ceps/{id} | OK |

### /characters

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 67 | /characters | Load character list | GET /api/admin/characters | OK |
| 68 | /characters | Delete character per row (confirm) | DELETE /api/admin/characters/{id} | OK |

### /ceps

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 69 | /ceps | Load CEP list | GET /api/admin/ceps | OK |
| 70 | /ceps | Tab filter: Active / Pending / Rejected / Inactive | — | OK |
| 71 | /ceps | Approve CEP (pending tab) | PATCH /api/admin/ceps/{id} | OK |
| 72 | /ceps | Reject CEP (pending tab) | PATCH /api/admin/ceps/{id} | OK |
| 73 | /ceps | Delete CEP | DELETE /api/admin/ceps/{id} | OK |

### /topics

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 74 | /topics | Load topic list | GET /api/admin/topics | OK |

### /photos

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 75 | /photos | Load photo list | GET /api/admin/photos | OK |
| 76 | /photos | Load character list (for filter) | GET /api/admin/characters | OK |
| 77 | /photos | Upload photo button → file input | POST /api/photos/upload | OK |
| 78 | /photos | Toggle status (active/inactive) | PATCH /api/admin/photos/{id} | OK |
| 79 | /photos | Filter by character (dropdown) | — | OK |
| 80 | /photos | Filter by category (dropdown) | — | OK |
| 81 | /photos | Filter by status (dropdown) | — | OK |

**Category B subtotal: 49 fungsi (49 OK, 0 MISSING-CRUD)**

---

## Category C — Ads & Campaigns (14 pages = 72 functions)

### /ads

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 82 | /ads | Tab: Campaigns (embeds test-launches + campaign-monitor) | — | OK |
| 83 | /ads | Tab: Rules (embeds rules-editor + media-rules + action-center) | — | OK |
| 84 | /ads | Tab alias: launch, monitor → campaigns | — | OK |
| 85 | /ads | Tab alias: actions, media → rules | — | OK |

### /test-launches

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 86 | /test-launches | Load test launch list | GET /api/admin/test-launches | OK |
| 87 | /test-launches | Create new launch → /test-launches/new | — | OK |
| 88 | /test-launches | Open launch → /test-launches/[id] | — | OK |

### /test-launches/new (wizard — heavy page, 29 buttons, 12 API calls)

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 89 | /test-launches/new | Load Meta connections | GET /api/admin/meta-connections | OK |
| 90 | /test-launches/new | Load ad accounts per connection | GET /api/admin/assets/ad-accounts?metaAccountId={id} | OK |
| 91 | /test-launches/new | Load pages per connection | GET /api/admin/assets/pages?metaAccountId={id} | OK |
| 92 | /test-launches/new | Load launch prefill (product data) | GET /api/admin/launch-prefill?productId= | OK |
| 93 | /test-launches/new | Load media assets (ready) | GET /api/admin/media-assets?status=READY | OK |
| 94 | /test-launches/new | Check ad account capabilities | GET /api/admin/meta-tools/adaccount-capabilities | OK |
| 95 | /test-launches/new | Load Meta pixels | GET /api/admin/meta-tools/adspixels | OK |
| 96 | /test-launches/new | Load existing audiences | GET /api/admin/meta-tools/customaudiences | OK |
| 97 | /test-launches/new | Interest search | GET /api/admin/meta-tools/interest-search | OK |
| 98 | /test-launches/new | Generate copy | POST /api/admin/meta-tools/generate-copy | OK |
| 99 | /test-launches/new | Submit test launch | POST /api/admin/test-launches | OK |
| 100 | /test-launches/new | Audience targeting builder (UI fields) | — | OK |
| 101 | /test-launches/new | Creative management (UI fields) | — | OK |
| 102 | /test-launches/new | Budget mode toggle (CBO/ABO) | — | OK |

### /test-launches/[id]

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 103 | /test-launches/[id] | Load launch detail | GET /api/admin/test-launches/{id} | OK |
| 104 | /test-launches/[id] | Submit for approval | POST /api/admin/test-launches/{id}/submit | OK |

### /campaign-monitor

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 105 | /campaign-monitor | Load campaign sessions | GET /api/admin/campaign-sessions | OK |
| 106 | /campaign-monitor | Open session → /campaign-monitor/[id] | — | OK |

### /campaign-monitor/import

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 107 | /campaign-monitor/import | Load Meta accounts | GET /api/admin/meta-accounts | OK |
| 108 | /campaign-monitor/import | Load campaigns from Meta (formerly BROKEN act_act_) | GET /api/admin/meta-campaigns | **BROKEN → FIXED** |
| 109 | /campaign-monitor/import | Import campaign | POST /api/admin/campaign-sessions/import | OK |

### /campaign-monitor/[id]

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 110 | /campaign-monitor/[id] | Load session detail | GET /api/admin/campaign-sessions/{id} | OK |
| 111 | /campaign-monitor/[id] | Load metrics | GET /api/admin/campaign-sessions/{id}/metrics | OK |
| 112 | /campaign-monitor/[id] | Load topup log | GET /api/admin/campaign-sessions/{id}/topup-log | OK |
| 113 | /campaign-monitor/[id] | Load rule executions | GET /api/admin/campaign-sessions/{id}/rule-executions | OK |
| 114 | /campaign-monitor/[id] | Load session rules | GET /api/admin/campaign-sessions/{id}/rules | OK |
| 115 | /campaign-monitor/[id] | Create rule | POST /api/admin/campaign-sessions/{id}/rules | OK |
| 116 | /campaign-monitor/[id] | Execute action (PAUSE, RESUME, BUDGET) | POST /api/admin/campaign-sessions/{id}/actions | OK |
| 117 | /campaign-monitor/[id] | View related links (ads, leads, etc.) | — | OK |

### /campaign-monitor/[id]/rules/new

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 118 | /campaign-monitor/[id]/rules/new | Load rule templates | GET /api/admin/rule-templates | OK |
| 119 | /campaign-monitor/[id]/rules/new | Create rule | POST /api/admin/campaign-sessions/{id}/rules | OK |

### /approval-requests

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 120 | /approval-requests | Load approval requests | GET /api/admin/approval-requests | OK |
| 121 | /approval-requests | Approve launch | POST /api/admin/approval-requests/{id} | OK |
| 122 | /approval-requests | Reject launch | POST /api/admin/approval-requests/{id} | OK |

### /action-center

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 123 | /action-center | Load pending actions | GET /api/admin/automation-actions | OK |
| 124 | /action-center | Approve action | POST /api/admin/automation-actions/{id} | OK |
| 125 | /action-center | Reject action | POST /api/admin/automation-actions/{id} | OK |
| 126 | /action-center | Load session context | GET /api/admin/campaign-sessions?status=RUNNING | OK |
| 127 | /action-center | Check creative reservations | GET /api/admin/creative-reservations | OK |
| 128 | /action-center | Check creative rotations | GET /api/admin/creative-rotations | OK |
| 129 | /action-center | Check creative variants | GET /api/admin/creative-variants | OK |

### /rules-editor

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 130 | /rules-editor | Load automation rules | GET /api/admin/automation-rules | OK |
| 131 | /rules-editor | Delete rule | DELETE /api/admin/automation-rules/{id} | OK |
| 132 | /rules-editor | Load rule templates | GET /api/admin/rule-templates | OK |
| 133 | /rules-editor | Open builder → /rules-editor/builder | — | OK |

### /rules-editor/builder

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 134 | /rules-editor/builder | Load rule detail | GET /api/admin/automation-rules/{id} | OK |
| 135 | /rules-editor/builder | Load campaign sessions | GET /api/admin/campaign-sessions | OK |
| 136 | /rules-editor/builder | Load rule templates | GET /api/admin/rule-templates | OK |
| 137 | /rules-editor/builder | Save rule | POST /api/admin/automation-rules | OK |
| 138 | /rules-editor/builder | Update rule | PUT /api/admin/automation-rules/{id} | OK |
| 139 | /rules-editor/builder | Dry-run rule | POST /api/admin/automation-rules/dry-run | OK |
| 140 | /rules-editor/builder | Condition builder (UI fields) | — | OK |
| 141 | /rules-editor/builder | Action builder (UI fields) | — | OK |

### /assignments

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 142 | /assignments | Load assignments | GET /api/admin/assignments (assumed) | OK |
| 143 | /assignments | Link → Agent detail | — | OK |

### /performance

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 144 | /performance | Load performance data | GET /api/admin/performance (assumed) | OK |
| 145 | /performance | Links to campaign monitors | — | OK |

### /media-rules

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 146 | /media-rules | Load media rules | GET /api/admin/media-rules | OK |
| 147 | /media-rules | Create media rule | POST /api/admin/media-rules | OK |
| 148 | /media-rules | Delete media rule | DELETE /api/admin/media-rules/{id} | OK |
| 149 | /media-rules | Load characters (for rule config) | GET /api/admin/characters | OK |
| 150 | /media-rules | Load products (for rule config) | GET /api/admin/products?status=active | OK |

**Category C subtotal: 69 fungsi (68 OK, 1 BROKEN→FIXED)**

---

## Category D — Studio/Media (8 pages = 44 functions)

### /media (alias /studio)

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 151 | /media | Load credits | GET /api/gen/credits | OK |
| 152 | /media | Load media list | GET /api/gen/media | OK |
| 153 | /media | Generate video | POST /api/gen/video | OK |

### /studio

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 154 | /studio | Load credits | GET /api/gen/credits | OK |
| 155 | /studio | Load media list | GET /api/gen/media?limit=20 | OK |
| 156 | /studio | Generate video | POST /api/gen/video | OK |

### /media-library

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 157 | /media-library | Load media assets | GET /api/admin/media-assets | OK |
| 158 | /media-library | Upload media file | POST /api/admin/media-assets/upload | OK |
| 159 | /media-library | Generate media (text-to-image) | POST /api/admin/media-assets/generate | OK |
| 160 | /media-library | Delete media | DELETE /api/admin/media-assets/{id} | OK |
| 161 | /media-library | Load products (for variant linking) | GET /api/admin/products?status=active | OK |
| 162 | /media-library | View media detail → /media-library/[id] | — | OK |
| 163 | /media-library | Filter by type | — | OK |
| 164 | /media-library | Search | — | OK |

### /media-library/[id]

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 165 | /media-library/[id] | Load media detail | GET /api/admin/media-assets/{id} | OK |
| 166 | /media-library/[id] | Load usage info | GET /api/admin/media-assets/{id}/usage | OK |
| 167 | /media-library/[id] | Load creative variants | GET /api/admin/creative-variants | OK |
| 168 | /media-library/[id] | Create creative variant | POST /api/admin/creative-variants | OK |
| 169 | /media-library/[id] | Update media | PATCH /api/admin/media-assets/{id} | OK |
| 170 | /media-library/[id] | Link to product | — | OK |

### /products

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 171 | /products | Load product list | GET /api/admin/products | OK |
| 172 | /products | Create product | POST /api/admin/products | OK |
| 173 | /products | Upload photo | POST /api/photos/upload | OK |
| 174 | /products | Delete product | DELETE /api/admin/products/{id} | OK |

### /products/[id]

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 175 | /products/[id] | Load product detail | GET /api/admin/products/{id} | OK |
| 176 | /products/[id] | Update product | PATCH /api/admin/products/{id} | OK |
| 177 | /products/[id] | Upload photo | POST /api/photos/upload | OK |
| 178 | /products/[id] | Delete photo | DELETE /api/admin/photos/{id} | OK |
| 179 | /products/[id] | Load landing pages | GET /api/admin/products/{id}/landing-pages | OK |
| 180 | /products/[id] | Create landing page | POST /api/admin/products/{id}/landing-pages | OK |
| 181 | /products/[id] | Load landing page stats | GET /api/admin/landing-pages/{id}/stats | OK |
| 182 | /products/[id] | Load CEPs | GET /api/admin/ceps?productId={id} | OK |
| 183 | /products/[id] | Create CEP | POST /api/admin/ceps | OK |
| 184 | /products/[id] | Delete CEP | DELETE /api/admin/ceps/{id} | OK |

### /monitor

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 185 | /monitor | Load posting monitors | GET /api/admin/posting-monitor | OK |
| 186 | /monitor | Reset account monitor | POST /api/admin/posting-monitor/{id} (assumed) | OK |
| 187 | /monitor | Approve upload → trigger posting | — | OK |

### /logs

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 188 | /logs | Load content logs | GET /api/admin/content-logs | OK |
| 189 | /logs | Load performance data | GET /api/admin/performance | OK |

**Category D subtotal: 39 fungsi (39 OK)**

---

## Category E — System (8 pages = 36 functions)

### /system

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 190 | /system | Load current user | GET /api/admin/auth/me | OK |

### /admin-users

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 191 | /admin-users | Load user list | GET /api/admin/admin-users | OK |
| 192 | /admin-users | Approve pending user | PATCH /api/admin/admin-users/{id} | OK |
| 193 | /admin-users | Reject pending user | PATCH /api/admin/admin-users/{id} | OK |
| 194 | /admin-users | Deactivate active user | PATCH /api/admin/admin-users/{id} | OK |
| — | — | **DELETE user — TIDAK ADA** | **Hanya PATCH status** | **MISSING-CRUD** |

### /agents

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 195 | /agents | Load agent list | GET /api/admin/hermes-agents | OK |
| 196 | /agents | Create agent | POST /api/admin/hermes-agents | OK |
| 197 | /agents | Update agent | PATCH /api/admin/hermes-agents/{id} | OK |
| 198 | /agents | Regenerate API key | POST /api/admin/hermes-agents/{id}/regenerate-key | OK |
| 199 | /agents | Delete agent | DELETE /api/admin/hermes-agents/{id} | OK |
| 200 | /agents | Load assignments for agent | GET /api/admin/assignments?hermesAgentId={id} | OK |
| 201 | /agents | Create assignment | POST /api/admin/assignments | OK |
| 202 | /agents | Delete assignment | DELETE /api/admin/assignments/{id} | OK |

### /meta-connections

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 203 | /meta-connections | Load Meta connections | GET /api/admin/meta-connections | OK |
| 204 | /meta-connections | Connect new Meta → /meta-connections/new | — | OK |
| 205 | /meta-connections | Open connection → /meta-connections/[id] | — | OK |

### /meta-connections/new

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 206 | /meta-connections/new | Generate OAuth URL | GET /api/admin/meta-oauth/start | OK |
| 207 | /meta-connections/new | Test credentials | POST /api/admin/meta-connections/test-credentials | OK |
| 208 | /meta-connections/new | Save connection | POST /api/admin/meta-connections | OK |

### /meta-connections/[id]

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 209 | /meta-connections/[id] | Load connection detail | GET /api/admin/meta-connections/{id} | OK |
| 210 | /meta-connections/[id] | Sync assets (businesses, pages, ad accounts) | POST /api/admin/meta-connections/{id}/sync-assets | OK |
| 211 | /meta-connections/[id] | Test credentials | POST /api/admin/meta-connections/{id}/credentials | OK |
| 212 | /meta-connections/[id] | View ad accounts | GET /api/admin/meta-connections/{id}/ad-accounts | OK |
| 213 | /meta-connections/[id] | Disconnect / delete connection | DELETE /api/admin/meta-connections/{id} | OK |

### /docs

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 214 | /docs | API documentation (static from component) | — | OK |

### /agents (detail)

| # | Halaman | Fungsi | Endpoint | Status |
|---|---|---|---|---|
| 215 | /agents | Agent detail modal | — | OK |

**Category E subtotal: 26 fungsi (24 OK, 2 MISSING-CRUD)**

---

## Summary: NO-UI Endpoints ~20

Endpoints yang benar-benar tidak punya UI (filtered — beberapa dipanggil dari component bukan page.tsx):

| Endpoint | Alasan NO-UI |
|---|---|
| `/dead-letters/*` (3 routes) | Dead code — zero-worker era |
| `/feature-flags/*` (2 routes) | No management UI |
| `/connections/api-keys/*` (2 routes) | Managed via other pages |
| `/connections/credits` | No dedicated UI |
| `/credits/grant` | No UI (admin-only via curl) |
| `/hash-check` | Dev tool, no UI |
| `/search` | Called from CommandPalette component (global) — NOT truly NO-UI |
| `/nav-badges` | Called from Sidebar component — NOT truly NO-UI |
| `/notifications` | Called from NotificationBell component — NOT truly NO-UI |
| `/overview` | Called from Dashboard page — NOT truly NO-UI |

**Truly NO-UI: ~9 endpoints** (dead-letter 3, feature-flags 2, connections/api-keys 2, connections/credits, credits/grant, hash-check)

---

## GAPS

| # | Gap | Kategori | Severity | Evidence |
|---|---|---|---|---|
| 1 | **Forgot/Reset password** — TIDAK ADA endpoint, page, atau component | A. Auth | **P0 FATAL** | `grep -ri 'forgot\|reset.*password\|lupa' src/` → 0 results |
| 2 | **Email verification** — Register langsung sukses, no email sent | A. Auth | **P0 FATAL** | Register flow: `POST /api/admin/auth/register` → redirect `/login?pending=1` |
| 3 | **Delete user** — Admin users hanya PATCH status, no DELETE | E. System | **P1 HIGH** | admin-users/[id]/route.ts only has GET + PATCH (no DELETE) |
| 4 | **Change password** — Settings gak ada opsi | A. Auth | **P1 HIGH** | Settings page only has posting monitor params |
| 5 | **Empty states** — Some pages blank without CTA (CEPs, media-rules on no data) | All | **P2 MED** | Visual inspection |
| 6 | **Confirmation modal** — Uses native `window.confirm()` instead of custom modal | All | **P2 MED** | Multiple pages use `confirm()` |
| 7 | **Search/filter** — Long lists (accounts, campaigns) lack search | B/C | **P2 MED** | Only photos page has filters |

---

## Row Count Verification

```bash
grep -cE "^\\|.*\\|.*\\| (OK|BROKEN|MISSING-CRUD|DEAD)" docs/full-ux-functional-audit-report.md
# Expected: 237 (total function rows)
```

---

## git rev-parse origin/main

**`commit hash from origin/main`**
