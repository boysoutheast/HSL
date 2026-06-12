'use client'

import { useState } from 'react'

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.boytenggara.com'

type TabKey = 'auth' | 'library' | 'characters' | 'tasks' | 'content' | 'capi' | 'admin'

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-stone-900 text-stone-100 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
      {children}
    </pre>
  )
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-700',
    POST: 'bg-blue-100 text-blue-700',
    PATCH: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-red-100 text-red-700',
  }
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${colors[method] ?? 'bg-stone-100'}`}>{method}</span>
      <div className="min-w-0">
        <code className="text-xs font-mono text-stone-800 break-all">{path}</code>
        <p className="text-xs text-stone-500">{desc}</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 mb-4">
      <h2 className="text-sm font-bold text-stone-900 mb-3">{title}</h2>
      {children}
    </div>
  )
}

export default function DocsPage() {
  const [tab, setTab] = useState<TabKey>('auth')

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'auth', label: '🔑 Auth' },
    { key: 'library', label: '📚 Library' },
    { key: 'characters', label: '🎭 Characters' },
    { key: 'tasks', label: '⚡ Task Queue' },
    { key: 'content', label: '🛍️ Content' },
    { key: 'capi', label: '📡 CAPI' },
    { key: 'admin', label: '🛠 Admin API' },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">H</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-stone-900">HSL API — Dokumentasi</h1>
            <p className="text-xs text-stone-500">{BASE}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-1 bg-white border border-stone-200 rounded-xl p-1 mb-6">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 min-w-[100px] py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === key ? 'bg-violet-600 text-white' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── AUTH ── */}
        {tab === 'auth' && (
          <>
            <Section title="Hermes Agent — Bearer Token">
              <p className="text-sm text-stone-600 mb-3">
                Semua endpoint <code className="text-xs bg-stone-100 px-1 rounded">/api/hermes/*</code> pakai
                API key agent (dibuat admin di halaman Agents). Kirim sebagai Bearer token.
              </p>
              <Code>{`curl -H "Authorization: Bearer hsl_xxxxxxxx" \\
  ${BASE}/api/hermes/library`}</Code>
              <p className="text-xs text-stone-500 mt-2">
                Response selalu difilter berdasarkan assignment agent (akun, character, topic, product, CEP).
              </p>
            </Section>

            <Section title="Admin Dashboard — Session Cookie">
              <p className="text-sm text-stone-600 mb-2">
                Login via email+password atau <strong>Sign in with Google</strong>. Session cookie 8 jam.
              </p>
              <Endpoint method="POST" path="/api/admin/auth/login" desc="Body: { email, password }" />
              <Endpoint method="GET" path="/api/admin/auth/google" desc="Redirect ke Google OAuth (perlu GOOGLE_CLIENT_ID/SECRET)" />
              <Endpoint method="POST" path="/api/admin/auth/logout" desc="Hapus session" />
            </Section>

            <Section title="Meta — Facebook Login for Business">
              <p className="text-sm text-stone-600 mb-2">
                Connect akun Meta tanpa paste token manual. Klik <strong>Connect with Facebook</strong> di
                halaman Meta Connections → OAuth → token long-lived (60 hari) disimpan terenkripsi +
                auto-sync Business, Ad Accounts, Pages, IG.
              </p>
              <Endpoint method="GET" path="/api/admin/meta-oauth/start" desc="Mulai OAuth flow (perlu META_APP_ID/SECRET, opsional META_LOGIN_CONFIG_ID)" />
              <Endpoint method="GET" path="/api/admin/meta-oauth/callback" desc="Callback — jangan dipanggil manual" />
            </Section>

            <Section title="Cron — x-cron-secret">
              <Code>{`curl -X POST -H "x-cron-secret: $CRON_SECRET" \\
  ${BASE}/api/cron/media-rules`}</Code>
              <div className="mt-2">
                <Endpoint method="POST" path="/api/cron/posting-monitor" desc="Evaluasi posting monitor" />
                <Endpoint method="POST" path="/api/cron/media-rules" desc="Evaluasi media auto top-up rules (jalankan tiap jam)" />
                <Endpoint method="POST" path="/api/cron/fetch-metrics" desc="Tarik metrics" />
                <Endpoint method="POST" path="/api/cron/cleanup-locks" desc="Bersihkan lock expired" />
              </div>
            </Section>
          </>
        )}

        {/* ── LIBRARY ── */}
        {tab === 'library' && (
          <>
            <Section title="GET /api/hermes/library">
              <p className="text-sm text-stone-600 mb-3">
                Satu endpoint untuk semua data assigned: akun IG, characters, topics, CEPs, products
                (termasuk <strong>landingPages</strong>), photo references, dan <strong>mediaAssets</strong> (foto+video).
              </p>
              <Code>{`{
  "agent": { "id": "...", "name": "Worker A" },
  "library": {
    "instagramAccounts": [
      {
        "id": "acc_xxx", "username": "budi_official",
        "accountName": "Budi Official", "gender": "M",
        "status": "active", "purpose": "cpas"
      }
    ],
    "characters": [
      {
        "id": "char_xxx",
        "name": "Budi Santoso",
        "description": "Karakter ibu rumah tangga 30an, bercerita produk kecantikan",
        "behavior": "Santai, hangat, relatable. Sesekali pakai bahasa Jawa.",
        "speakingStyle": "Casual, sering pakai kata 'aku', kalimat pendek",
        "expressionStyle": "Ekspresif, sering tersenyum, kontak mata ke kamera",
        "movementStyle": "Gerakan natural, tidak kaku, kadang sambil masak",
        "forbiddenRules": "Jangan sebut kompetitor. Jangan klaim medis.",
        "status": "active",
        "photoCount": 5,
        "photoReferences": [
          {
            "id": "...", "fileUrl": "https://ai.boytenggara.com/api/photos/serve/...",
            "thumbnailUrl": "https://...", "label": "Foto referensi 1",
            "category": "face", "status": "active"
          }
        ]
      }
    ],
    "topics": [...],
    "ceps": [...],
    "products": [{
      "id": "...", "name": "...",
      "landingPages": [
        { "url": "https://...", "variant": "A", "type": "shopee", "isDefault": true }
      ]
    }],
    "mediaAssets": [
      { "type": "VIDEO", "fileUrl": "https://...", "duration": 23.5, "aspectRatio": "9:16" }
    ]
  }
}`}</Code>
            </Section>

            <Section title="Endpoint Library Lain">
              <Endpoint method="GET" path="/api/hermes/ready-upload" desc="Akun berikutnya yang siap di-post (polling lama, masih jalan)" />
              <Endpoint method="GET" path="/api/hermes/photos" desc="Foto referensi assigned" />
              <Endpoint method="GET" path="/api/hermes/ceps" desc="CEP assigned" />
            </Section>
          </>
        )}

        {/* ── CHARACTERS ── */}
        {tab === 'characters' && (
          <>
            <Section title="Apa itu Character?">
              <p className="text-sm text-stone-600">
                Character adalah <strong>persona AI</strong> yang dikaitkan ke akun Instagram tertentu.
                Hermes pakai data ini untuk menghasilkan konten yang konsisten — gaya bicara, ekspresi,
                gerakan, dan aturan yang harus dipatuhi. Satu akun IG bisa punya banyak character;
                satu character bisa punya banyak topics dan foto referensi.
              </p>
            </Section>

            <Section title="Fields Character">
              <div className="space-y-2">
                {[
                  ['id', 'String', 'ID unik character (CUID)'],
                  ['instagramAccountId', 'String', 'ID akun Instagram yang dipakai character ini'],
                  ['name', 'String', 'Nama karakter — dipakai sebagai identitas di konten'],
                  ['description', 'String', 'Deskripsi singkat siapa karakter ini (latar belakang, persona)'],
                  ['behavior', 'String?', 'Cara berperilaku secara umum — tone, sikap, nilai'],
                  ['speakingStyle', 'String?', 'Gaya bicara: formal/casual, panjang kalimat, kata khas'],
                  ['expressionStyle', 'String?', 'Ekspresi wajah dan emosi yang sering ditampilkan'],
                  ['movementStyle', 'String?', 'Gaya gerakan tubuh saat di depan kamera'],
                  ['forbiddenRules', 'String?', 'Larangan keras: topik, kata, klaim yang tidak boleh muncul'],
                  ['status', '"active"|"inactive"', 'Hanya character active yang masuk library Hermes'],
                  ['photoCount', 'number', 'Jumlah foto referensi active (computed, bukan kolom DB)'],
                  ['photoReferences', 'Array', 'Foto referensi penampilan karakter (untuk video generation)'],
                ].map(([field, type, desc]) => (
                  <div key={field} className="grid grid-cols-[140px_1fr] gap-2 text-xs border-b border-stone-100 pb-2">
                    <div>
                      <code className="font-mono text-violet-700">{field}</code>
                      <span className="block text-stone-400">{type}</span>
                    </div>
                    <span className="text-stone-600">{desc}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Hermes — Akses via Library">
              <p className="text-sm text-stone-600 mb-3">
                Character tersedia di <code className="text-xs bg-stone-100 px-1 rounded">GET /api/hermes/library</code> →{' '}
                <code className="text-xs bg-stone-100 px-1 rounded">library.characters[]</code>.
                Hanya character yang <strong>di-assign ke agent</strong> yang muncul (lewat halaman Assignments).
              </p>
              <Code>{`# Ambil semua data termasuk characters
curl -H "Authorization: Bearer hsl_xxx" \\
  ${BASE}/api/hermes/library

# Filter characters dari response
# library.characters[] → gunakan fields:
#   name, description, behavior, speakingStyle,
#   expressionStyle, movementStyle, forbiddenRules
#   photoReferences[].fileUrl  → URL foto referensi`}</Code>
            </Section>

            <Section title="Admin API — CRUD Characters">
              <p className="text-sm text-stone-600 mb-2">
                Semua endpoint pakai <strong>session cookie admin</strong>. Non-admin hanya bisa akses character
                milik akun IG yang dia punya.
              </p>
              <Endpoint method="GET" path="/api/admin/characters" desc="List semua characters. Query: ?instagramAccountId=&status=active" />
              <Endpoint method="POST" path="/api/admin/characters" desc="Buat character baru. Required: instagramAccountId, name, description" />
              <Endpoint method="GET" path="/api/admin/characters/[id]" desc="Detail character + instagramAccount + photoReferences active + topics active" />
              <Endpoint method="PATCH" path="/api/admin/characters/[id]" desc="Update field apapun (name/description/behavior/speakingStyle/expressionStyle/movementStyle/forbiddenRules/status)" />
              <Endpoint method="DELETE" path="/api/admin/characters/[id]" desc="Hapus character + cascade delete topics, CEPs, photo files dari storage" />
            </Section>

            <Section title="Contoh: Buat Character">
              <Code>{`curl -X POST -H "Content-Type: application/json" \\
  -b "session=..." \\
  -d '{
    "instagramAccountId": "acc_xxx",
    "name": "Budi Santoso",
    "description": "Ibu rumah tangga 30an, bercerita produk kecantikan",
    "behavior": "Hangat, relatable, sesekali humor ringan",
    "speakingStyle": "Casual, kalimat pendek, sering pakai kata aku",
    "expressionStyle": "Ekspresif, sering tersenyum, kontak mata ke kamera",
    "movementStyle": "Natural, tidak kaku, kadang sambil aktivitas dapur",
    "forbiddenRules": "Jangan sebut kompetitor. Jangan klaim medis atau klinis.",
    "status": "active"
  }' \\
  ${BASE}/api/admin/characters

# → 201 { "character": { "id": "char_xxx", ... } }`}</Code>
            </Section>

            <Section title="Foto Referensi Character">
              <p className="text-sm text-stone-600 mb-2">
                Foto referensi dipakai untuk video/image generation — Hermes tahu tampilan fisik karakter.
                Upload via halaman Characters di dashboard (atau endpoint admin photos).
                Semua URL sudah absolute di response library.
              </p>
              <Code>{`# library.characters[0].photoReferences
[
  {
    "id": "photo_xxx",
    "fileUrl": "https://ai.boytenggara.com/api/photos/serve/characters/char_xxx/1.jpg",
    "thumbnailUrl": "https://ai.boytenggara.com/api/photos/serve/thumb/...",
    "label": "Foto referensi utama",
    "category": "face",
    "status": "active"
  }
]`}</Code>
            </Section>
          </>
        )}

        {/* ── TASKS ── */}
        {tab === 'tasks' && (
          <>
            <Section title="Task Queue — Generate Konten On-Demand">
              <p className="text-sm text-stone-600 mb-3">
                Media Rules / admin bikin task (GENERATE_VIDEO, GENERATE_PHOTO, CAPTION_ONLY, dll).
                Worker claim → kerjakan → complete dengan hasil. Claim bersifat atomic — dua worker
                tidak bisa dapat task yang sama.
              </p>
              <Endpoint method="GET" path="/api/hermes/tasks?types=GENERATE_VIDEO,GENERATE_PHOTO" desc="List task pending (max 10)" />
              <Endpoint method="POST" path="/api/hermes/tasks" desc="Claim task. Body: { taskId?, types? } — kosongkan untuk auto-pick" />
              <Endpoint method="POST" path="/api/hermes/tasks/[id]" desc="Update lifecycle. Body: { action: 'complete'|'fail', ... }" />
            </Section>

            <Section title="Contoh: Claim → Complete">
              <Code>{`# 1. Claim
curl -X POST -H "Authorization: Bearer hsl_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"types":["GENERATE_VIDEO"]}' \\
  ${BASE}/api/hermes/tasks

# → { "task": { "id": "task_123", "type": "GENERATE_VIDEO", "payload": {...} } }

# 2. Selesai — daftarkan hasil video sebagai MediaAsset
curl -X POST -H "Authorization: Bearer hsl_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "complete",
    "result": { "note": "video 23s, hook variant B" },
    "mediaAsset": {
      "fileUrl": "https://cdn.example.com/video.mp4",
      "type": "VIDEO",
      "mimeType": "video/mp4",
      "fileSizeBytes": 1048576,
      "duration": 23.5,
      "aspectRatio": "9:16",
      "label": "Auto top-up video"
    }
  }' \\
  ${BASE}/api/hermes/tasks/task_123

# Gagal? action: "fail" + error → auto-retry sampai maxAttempts, lalu dead letter.`}</Code>
            </Section>
          </>
        )}

        {/* ── CONTENT ── */}
        {tab === 'content' && (
          <>
            <Section title="Submit Hasil Konten">
              <Endpoint method="POST" path="/api/hermes/content-log" desc="Log hasil generate/post. Body: accountId, characterId?, topicId?, cepId?, contentType, caption, mediaUrl, postUrl..." />
              <Endpoint method="POST" path="/api/hermes/cep-feedback" desc="Submit CEP baru untuk review admin. Body: { topicId, cepText, painPoint?, angle? }" />
            </Section>
            <Section title="Produk & Landing Pages">
              <p className="text-sm text-stone-600 mb-2">
                Produk di library response include <code className="text-xs bg-stone-100 px-1 rounded">landingPages[]</code> —
                pakai LP dengan <code className="text-xs bg-stone-100 px-1 rounded">isDefault: true</code> untuk CTA,
                atau variant lain kalau task payload menyebut variant tertentu (A/B testing).
              </p>
            </Section>
          </>
        )}

        {/* ── CAPI ── */}
        {tab === 'capi' && (
          <>
            <Section title="CAPI Proxy — Conversion Tracking Tanpa Expose Token">
              <p className="text-sm text-stone-600 mb-3">
                Endpoint publik. Admin buat config di dashboard (pixel ID + access token, disimpan
                terenkripsi) → dapat <code className="text-xs bg-stone-100 px-1 rounded">configId</code>.
                Landing page tinggal POST event ke sini, HSL forward ke Meta CAPI (v25.0).
                Rate limit 120 req/menit. Event invalid di-skip, bukan reject semua.
              </p>
              <Endpoint method="POST" path="/api/capi/events" desc="Body: { configId, events: [...] } — max 100 event/request" />
              <Code>{`curl -X POST -H "Content-Type: application/json" \\
  -d '{
    "configId": "clxxx...",
    "events": [{
      "event_name": "Purchase",
      "action_source": "website",
      "event_source_url": "https://lp.example.com/produk",
      "user_data": { "em": ["<sha256 email>"] },
      "custom_data": { "value": 150000, "currency": "IDR" }
    }]
  }' \\
  ${BASE}/api/capi/events`}</Code>
              <p className="text-xs text-stone-500 mt-2">
                Kalau config terhubung ke Landing Page, conversion otomatis tercatat di LP stats.
              </p>
            </Section>
          </>
        )}

        {/* ── ADMIN ── */}
        {tab === 'admin' && (
          <>
            <Section title="Catatan">
              <p className="text-sm text-stone-600">
                Semua endpoint admin pakai session cookie (login dulu). Data difilter per ownership —
                admin lihat semua, user lihat miliknya sendiri.
              </p>
            </Section>
            <Section title="Landing Pages & Stats">
              <Endpoint method="GET" path="/api/admin/products/[id]/landing-pages" desc="List LP per produk" />
              <Endpoint method="POST" path="/api/admin/products/[id]/landing-pages" desc="Tambah LP variant" />
              <Endpoint method="PATCH" path="/api/admin/landing-pages/[lpId]" desc="Update / set default / pause" />
              <Endpoint method="GET" path="/api/admin/landing-pages/[lpId]/stats" desc="Stats + summary (clicks, conversions, CR, revenue)" />
              <Endpoint method="POST" path="/api/admin/landing-pages/[lpId]/stats" desc="Record stat manual" />
            </Section>
            <Section title="Automation Rules">
              <Endpoint method="GET" path="/api/admin/automation-rules" desc="List rules" />
              <Endpoint method="POST" path="/api/admin/automation-rules" desc="Buat rule (custom condition tree + multi-action)" />
              <Endpoint method="POST" path="/api/admin/automation-rules/dry-run" desc="Preview: entity mana yang match kondisi" />
              <Endpoint method="GET" path="/api/admin/rule-templates" desc="Template builtin + custom" />
              <Endpoint method="POST" path="/api/admin/rule-templates" desc="Save rule sebagai template" />
            </Section>
            <Section title="Media Rules (Auto Top-up)">
              <Endpoint method="GET" path="/api/admin/media-rules" desc="List rules" />
              <Endpoint method="POST" path="/api/admin/media-rules" desc="Buat rule (MIN_COUNT / MAX_AGE_DAYS / NO_WINNER)" />
              <Endpoint method="PATCH" path="/api/admin/media-rules/[id]" desc="Update / pause" />
            </Section>
            <Section title="Meta — Audiences, Catalogs, Tools">
              <Endpoint method="GET" path="/api/admin/meta-audiences" desc="List custom + lookalike audiences" />
              <Endpoint method="POST" path="/api/admin/meta-audiences" desc="Buat audience (dispatch ke worker)" />
              <Endpoint method="GET" path="/api/admin/meta-catalogs" desc="List catalogs (CPAS foundation)" />
              <Endpoint method="POST" path="/api/admin/meta-catalogs/[id]" desc="Buat product set di catalog" />
              <Endpoint method="GET" path="/api/admin/meta-tools/ad-preview?adId=..&format=INSTAGRAM_REELS" desc="Preview ad per placement" />
              <Endpoint method="GET" path="/api/admin/meta-tools/ad-library?q=skincare&country=ID" desc="Cari ads kompetitor di Meta Ad Library" />
              <Endpoint method="GET" path="/api/admin/capi-configs" desc="List CAPI configs" />
              <Endpoint method="POST" path="/api/admin/capi-configs" desc="Buat config (pixelId + token)" />
            </Section>
            <Section title="Instagram Accounts">
              <Endpoint method="GET" path="/api/admin/accounts" desc="List akun IG. Query: ?status=active" />
              <Endpoint method="POST" path="/api/admin/accounts" desc="Buat akun. Body: { username*, accountName?, gender? ('M'|'F'), purpose?, notes? }" />
              <Endpoint method="GET" path="/api/admin/accounts/[id]" desc="Detail + characters + postingMonitor" />
              <Endpoint method="PATCH" path="/api/admin/accounts/[id]" desc="Update field: username/accountName/gender/purpose/notes/status" />
              <Endpoint method="DELETE" path="/api/admin/accounts/[id]" desc="Hapus akun + cascade characters/topics/CEPs/contentLogs" />
            </Section>
            <Section title="Worker Tasks">
              <Endpoint method="GET" path="/api/admin/worker-tasks?status=pending" desc="Monitor antrian task + counts per status" />
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
