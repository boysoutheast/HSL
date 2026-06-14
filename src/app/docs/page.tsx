'use client'

import { useState } from 'react'

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.boytenggara.com'

type TabKey = 'auth' | 'library' | 'tasks' | 'content' | 'video' | 'capi' | 'admin'

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
    { key: 'tasks', label: '⚡ Task Queue' },
    { key: 'content', label: '🛍️ Content' },
    { key: 'video', label: '🎬 Video Gen' },
    { key: 'capi', label: '📡 CAPI' },
    { key: 'admin', label: '🛠 Admin API' },
  ]

  return (
    <div className="space-y-6">
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
                API key agent (dibuat admin di <strong>System → Agents</strong>). Kirim sebagai Bearer token.
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
                <strong>System → Connections</strong> → OAuth → token long-lived (60 hari) disimpan terenkripsi +
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
                Satu endpoint untuk semua data assigned. <strong>Persona (character) sudah embedded langsung di setiap instagramAccount</strong> — tidak ada array <code className="text-xs bg-stone-100 px-1 rounded">characters[]</code> terpisah. Termasuk <code className="text-xs bg-stone-100 px-1 rounded">photoReferences[]</code> per akun.
              </p>
              <Code>{`{
  "agent": { "id": "...", "name": "Worker A" },
  "library": {
    "instagramAccounts": [
      {
        "id": "acc_xxx",
        "username": "budi_official",
        "accountName": "Budi Official",
        "gender": "F",
        "status": "active",
        "purpose": "cpas",
        "characterDescription": "Ibu rumah tangga 30an, bercerita produk kecantikan",
        "behavior": "Santai, hangat, relatable. Sesekali pakai bahasa Jawa.",
        "speakingStyle": "Casual, sering pakai kata 'aku', kalimat pendek",
        "expressionStyle": "Ekspresif, sering tersenyum, kontak mata ke kamera",
        "movementStyle": "Gerakan natural, tidak kaku, kadang sambil masak",
        "forbiddenRules": "Jangan sebut kompetitor. Jangan klaim medis.",
        "photoCount": 3,
        "photoReferences": [
          {
            "id": "...", "fileUrl": "https://ai.boytenggara.com/api/photos/serve/...",
            "thumbnailUrl": "https://...", "label": "Foto referensi 1",
            "category": "portrait", "status": "active"
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

        {/* ── VIDEO GEN ── */}
        {tab === 'video' && (
          <>
            <Section title="Video Generation">
              <p className="text-sm text-stone-600 mb-3">
                Generate video dari prompt + foto referensi. Hasil datang async,
                di-rehost ke storage HSL. Cek status via polling sampai
                <code className="text-xs bg-stone-100 px-1 rounded">completed</code>,
                lalu pakai <code className="text-xs bg-stone-100 px-1 rounded">videoUrl</code>.
              </p>
              <p className="text-sm text-stone-600 mb-2">Alur status:</p>
              <Code>{`queued → processing → ready_for_rehost → completed
                                  └→ failed (error di-surface, bukan silent)`}</Code>
            </Section>

            <Section title="Admin — Buat & Lihat Job">
              <p className="text-xs text-stone-500 mb-3">UI: <strong>Media → Generate</strong> — form prompt + foto referensi (1-5) + IG account (opsional), job list dengan polling 12 detik, video preview + download.</p>
              <Endpoint method="POST" path="/api/admin/generate/video" desc="Buat job. Body: { prompt*, instagramAccountId?, photoReferenceIds[] (1-5) }. Bikin generated_media + worker_task GENERATE_VIDEO. Return 201 { id, status, workerTaskId }" />
              <Endpoint method="GET" path="/api/admin/generate/video" desc="List job. Query: ?status=&instagramAccountId=&limit=20&offset=0. Include inputs (photoReference fileUrl + label)" />
              <Endpoint method="GET" path="/api/admin/generate/video/[id]" desc="Detail satu job + inputs" />
            </Section>

            <Section title="Hermes Agent — Ambil Hasil">
              <Endpoint method="GET" path="/api/gen/media" desc="List video jadi (Bearer token). Query: ?status=completed&limit=20. Scope: ownerUserId." />
              <p className="text-xs text-stone-500 mt-2">
                Response item: <code className="text-xs bg-stone-100 px-1 rounded">id, status, videoUrl, thumbnailUrl, prompt, durationSeconds, instagramAccountId, completedAt, inputs[]</code>
              </p>
            </Section>

            <Section title="Video Generator API — /api/gen/* (White-label)">
              <p className="text-sm text-stone-600 mb-3">
                Endpoint publik untuk customer. Pakai API key Bearer token.
                Semua endpoint white-label — tidak ada nama provider/model yang bocor.
              </p>

              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold text-violet-800 mb-2">🎬 Generate Video</h3>
                <Endpoint method="POST" path="/api/gen/video" desc="Buat video generation job. Body: prompt* (teks), photoReferenceIds[] (opsional, 0-5 ID foto referensi), instagramAccountId (opsional). Balikin 201 { id, status: 'queued', creditsCost, balanceRemaining }." />
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-stone-500">
                    <strong>Cost (server-side):</strong> SD 6s = 1,000 • SD 10s = 1,300 • HD = 2×. Tidak bisa di-override client.
                  </p>
                  <p className="text-xs text-stone-500">
                    <strong>Error:</strong> 401 (invalid key) • 402 (credits kurang) • 403 (agent bukan owner).
                  </p>
                </div>
                <Code>{`curl -X POST -H "Authorization: Bearer *** -H "Content-Type: application/json" \\
  -d '{"prompt":"Product demo cinematic 4K","photoReferenceIds":[]}' \\
  ${BASE}/api/gen/video`}</Code>
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold text-violet-800 mb-2">📊 Credits & Balance</h3>
                <Endpoint method="GET" path="/api/gen/credits" desc="Cek saldo + riwayat transaksi. Return: { balance (int), transactions[] (id, amount, reason, balanceAfter, createdAt) }." />
                <Code>{`curl -H "Authorization: Bearer *** \\
  ${BASE}/api/gen/credits`}</Code>
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold text-violet-800 mb-2">📹 Cek Hasil</h3>
                <Endpoint method="GET" path="/api/gen/media/[id]" desc="Detail satu generated media. Return: id, status (queued|processing|completed|failed), prompt, videoUrl, thumbnailUrl, creditsCost, errorMessage, completedAt." />
                <Endpoint method="GET" path="/api/gen/media" desc="List semua generated media milik agent. Query: ?status=completed&limit=20&offset=0." />
                <Endpoint method="GET" path="/api/gen/media/[id]/download" desc="Download/redirect ke videoUrl. 302 redirect. 409 kalau video belum ready." />
              </div>
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
            <Section title="Instagram Accounts (+ Persona)">
              <p className="text-sm text-stone-600 mb-2">
                Persona/character fields langsung ada di akun — tidak perlu endpoint terpisah.
              </p>
              <Endpoint method="GET" path="/api/admin/accounts" desc="List akun IG. Query: ?status=active" />
              <Endpoint method="POST" path="/api/admin/accounts" desc="Buat akun. Body: { username*, accountName?, gender? ('M'|'F'), purpose?, notes?, characterDescription?, behavior?, speakingStyle?, expressionStyle?, movementStyle?, forbiddenRules? }" />
              <Endpoint method="GET" path="/api/admin/accounts/[id]" desc="Detail + photoReferences + postingMonitor (semua persona fields included)" />
              <Endpoint method="PATCH" path="/api/admin/accounts/[id]" desc="Update field apapun termasuk persona: characterDescription/behavior/speakingStyle/expressionStyle/movementStyle/forbiddenRules" />
              <Endpoint method="DELETE" path="/api/admin/accounts/[id]" desc="Hapus akun + cascade topics/CEPs/contentLogs" />
            </Section>
            <Section title="Worker Tasks">
              <Endpoint method="GET" path="/api/admin/worker-tasks?status=pending" desc="Monitor antrian task + counts per status" />
            </Section>
          </>
        )}
      </div>
  )
}
