'use client'

import { useState } from 'react'

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.boytenggara.com'

type TabKey = 'connect' | 'generate' | 'credits' | 'library' | 'content' | 'capi' | 'admin' | 'workers' | 'cpas'

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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-5">
      <div className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-stone-900 mb-1.5">{title}</p>
        {children}
      </div>
    </div>
  )
}

export default function DocsPage() {
  const [tab, setTab] = useState<TabKey>('connect')

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'connect',  label: '🔌 Connect' },
    { key: 'generate', label: '🎬 Generate' },
    { key: 'credits',  label: '💳 Credits' },
    { key: 'library',  label: '📚 Library' },
    { key: 'content',  label: '🛍️ Content' },
    { key: 'workers' as TabKey, label: '🤖 Workers' },
    { key: 'cpas' as TabKey,    label: '🛍️ CPAS' },
    { key: 'capi',     label: '📡 CAPI' },
    { key: 'admin',    label: '🛠 Admin' },
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

        {/* ── CONNECT ── */}
        {tab === 'connect' && (
          <>
            <Section title="Cara Konek Agent ke HSL">
              <p className="text-sm text-stone-600 mb-4">
                Semua agent eksternal konek via <strong>API key</strong> yang di-generate dari dashboard.
                Satu key = satu agent = akses ke resource yang di-assign untuk agent tersebut.
              </p>

              <Step n={1} title="Daftar atau minta akses">
                <p className="text-xs text-stone-500">
                  Daftar di <strong>{BASE}/register</strong> → akun status <em>pending</em>.
                  Admin approve di System → Users sebelum bisa generate key.
                </p>
              </Step>

              <Step n={2} title="Generate API key">
                <p className="text-xs text-stone-500 mb-2">
                  Login → <strong>System → Connections</strong> → tombol "Generate API Key".
                  Key hanya muncul sekali — simpan baik-baik.
                </p>
                <Code>{`# Format key:
hsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Gunakan sebagai x-api-key header:
curl -H "x-api-key: hsk_xxx..." ${BASE}/api/gen/credits

# Atau Authorization: Bearer:
curl -H "Authorization: Bearer hsk_xxx..." ${BASE}/api/gen/credits`}</Code>
              </Step>

              <Step n={3} title="Cek koneksi + saldo">
                <Code>{`curl -H "x-api-key: hsk_xxx..." \\
  ${BASE}/api/gen/credits

# Response:
{
  "balance": 2000000,
  "transactions": [...]
}`}</Code>
                <p className="text-xs text-stone-500 mt-2">
                  Saldo diperlukan untuk generate video. Hubungi admin untuk top-up.
                </p>
              </Step>

              <Step n={4} title="Mulai generate">
                <Code>{`curl -X POST \\
  -H "x-api-key: hsk_xxx..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Demo produk skincare, gaya casual, 10 detik"}' \\
  ${BASE}/api/gen/video

# Response 201:
{
  "id": "gen_xxx",
  "status": "queued",
  "creditsCost": 1300,
  "balanceRemaining": 1998700
}`}</Code>
              </Step>

              <Step n={5} title="Poll sampai selesai">
                <Code>{`# Cek tiap ~15 detik
curl -H "x-api-key: hsk_xxx..." \\
  ${BASE}/api/gen/video/gen_xxx

# Status: queued → processing → completed (ada videoUrl) | failed (ada errorMessage)`}</Code>
              </Step>
            </Section>

            <Section title="Two Auth Systems — Mana yang Dipakai">
              <div className="space-y-3">
                <div className="flex gap-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <span className="text-violet-600 font-bold text-xs mt-0.5 shrink-0">x-api-key</span>
                  <div>
                    <p className="text-xs font-semibold text-stone-800">UserApiKey — untuk agent & integrasi</p>
                    <p className="text-xs text-stone-500">Generate dari System → Connections. Akses endpoint <code className="bg-stone-100 px-1 rounded">/api/gen/*</code>. Scope: resource milik akun sendiri.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 bg-stone-50 border border-stone-200 rounded-lg">
                  <span className="text-stone-500 font-bold text-xs mt-0.5 shrink-0">session cookie</span>
                  <div>
                    <p className="text-xs font-semibold text-stone-800">Dashboard login — untuk manusia</p>
                    <p className="text-xs text-stone-500">Login via browser ke <strong>{BASE}/login</strong>. Akses semua admin endpoint. Tidak cocok untuk automation.</p>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Error Codes Umum">
              <div className="space-y-1.5 text-xs">
                <div className="flex gap-3"><code className="text-red-600 font-mono w-8">401</code><span className="text-stone-600">API key tidak valid atau expired</span></div>
                <div className="flex gap-3"><code className="text-red-600 font-mono w-8">402</code><span className="text-stone-600">Saldo tidak cukup — hubungi admin untuk top-up</span></div>
                <div className="flex gap-3"><code className="text-red-600 font-mono w-8">403</code><span className="text-stone-600">Resource bukan milik agent ini</span></div>
                <div className="flex gap-3"><code className="text-red-600 font-mono w-8">404</code><span className="text-stone-600">Resource tidak ditemukan (atau bukan milik lo)</span></div>
                <div className="flex gap-3"><code className="text-red-600 font-mono w-8">409</code><span className="text-stone-600">Conflict — task sudah di-claim, atau idempotency hit</span></div>
              </div>
            </Section>

            <Section title="Tipe Key & Auth">
              <p className="text-sm text-stone-600 mb-3">HSL punya 3 jenis auth — pastikan pakai key yang sesuai endpoint-nya:</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-stone-400 uppercase border-b border-stone-100">
                    <th className="pb-2 pr-4 text-left font-medium">Key Type</th>
                    <th className="pb-2 pr-4 text-left font-medium">Header</th>
                    <th className="pb-2 text-left font-medium">Endpoint yang dilayani</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  <tr>
                    <td className="py-2 pr-4 font-medium text-stone-700">Gen API Key</td>
                    <td className="py-2 pr-4 font-mono text-stone-500">x-api-key: hsl_xxx</td>
                    <td className="py-2 text-stone-500">/api/gen/* (video, credits, media)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-stone-700">Content Agent Key</td>
                    <td className="py-2 pr-4 font-mono text-stone-500">Authorization: Bearer hsl_content_xxx</td>
                    <td className="py-2 text-stone-500">/api/hermes/* (library, ceps, content, cpas)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-stone-700">Worker Key</td>
                    <td className="py-2 pr-4 font-mono text-stone-500">Authorization: Bearer hsl_worker_xxx</td>
                    <td className="py-2 text-stone-500">/api/hermes/tasks (worker task queue)</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-stone-400 mt-3">
                Alias: <code className="bg-stone-100 px-1 rounded">/api/hermes/credits</code> dan <code className="bg-stone-100 px-1 rounded">/api/hermes/generate/video</code> otomatis redirect ke endpoint /api/gen/* yang sesuai.
              </p>
            </Section>
          </>
        )}

        {/* ── GENERATE ── */}
        {tab === 'generate' && (
          <>
            <Section title="Video Generation">
              <p className="text-sm text-stone-600 mb-3">
                Generate video dari prompt teks. Proses async — submit job, poll sampai
                <code className="text-xs bg-stone-100 px-1 rounded mx-1">completed</code>,
                lalu pakai <code className="text-xs bg-stone-100 px-1 rounded">videoUrl</code>.
              </p>
              <Code>{`queued → processing → completed (videoUrl siap)
                    └→ failed  (errorMessage — cek prompt / saldo)`}</Code>
            </Section>

            <Section title="Submit Job">
              <Endpoint method="POST" path="/api/gen/video" desc="Buat video generation job. Wajib multipart/form-data dengan foto referensi." />
              <div className="mt-3 space-y-1 text-xs text-stone-500">
                <p><strong>Cost (server-side, tidak bisa di-override):</strong> SD 6s = 1.000 · SD 10s = 1.300 · HD = 2×</p>
              </div>
              <div className="mt-3 pl-3 space-y-1 text-xs text-stone-600">
                <p><code className="bg-stone-100 px-1 rounded">prompt</code> <span className="text-red-500">*</span> — deskripsi video</p>
                <p><code className="bg-stone-100 px-1 rounded">file</code> <span className="text-red-500">*</span> — foto referensi karakter (binary, field name: <code className="bg-stone-100 px-1 rounded">file</code>)</p>
                <p><code className="bg-stone-100 px-1 rounded">orientation</code> — portrait (default) | landscape | square</p>
                <p><code className="bg-stone-100 px-1 rounded">resolution</code> — SD (default) | HD</p>
                <p><code className="bg-stone-100 px-1 rounded">durationSeconds</code> — 10 (default) | 6</p>
              </div>
              <div className="mt-3">
                <Code>{`curl -X POST \\
  -H "x-api-key: hsk_xxx..." \\
  -F "prompt=TVC 10 detik, karakter sesuai foto referensi, gaya casual" \\
  -F "orientation=portrait" \\
  -F "resolution=SD" \\
  -F "durationSeconds=10" \\
  -F "file=@/path/to/reference.jpg" \\
  ${BASE}/api/gen/video

# 201 Created:
{
  "id": "gen_xxx",
  "status": "processing",
  "creditsCost": 1300,
  "balanceAfter": 998700
}

# 400 — file tidak disertakan:
{ "error": "file is required" }

# 402 — saldo kurang:
{ "error": "Insufficient credits", "balance": 500, "required": 1300 }`}</Code>
              </div>
            </Section>

            <Section title="Cek Status Job">
              <Endpoint method="GET" path="/api/gen/video/[id]" desc="Detail satu job." />
              <div className="mt-3">
                <Code>{`curl -H "x-api-key: hsk_xxx..." \\
  ${BASE}/api/gen/video/gen_xxx

# completed:
{
  "id": "gen_xxx",
  "status": "completed",
  "videoUrl": "https://ai.boytenggara.com/api/photos/serve/...",
  "prompt": "Demo skincare...",
  "durationSeconds": 10,
  "completedAt": "2026-06-14T10:00:00Z"
}

# failed:
{
  "id": "gen_xxx",
  "status": "failed",
  "errorMessage": "Generation timed out"
}`}</Code>
              </div>
            </Section>

            <Section title="List Semua Job">
              <Endpoint method="GET" path="/api/gen/video" desc="List job milik agent. Query: ?limit=20&offset=0" />
              <Endpoint method="GET" path="/api/gen/media" desc="List semua generated media. Query: ?status=completed&limit=20&offset=0" />
              <Endpoint method="GET" path="/api/gen/media/[id]/download" desc="Download video — 302 redirect ke videoUrl. 409 jika belum selesai." />
            </Section>

            <Section title="Serve Endpoint — Identity Headers">
              <p className="text-sm text-stone-600 mb-2">
                Saat download video dari <code className="text-xs bg-stone-100 px-1 rounded">videoUrl</code>, serve endpoint return
                response headers yang bisa dipakai untuk verifikasi identitas content:
              </p>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex gap-3 p-3 bg-stone-50 border border-stone-200 rounded-lg">
                  <span className="text-violet-600 font-mono font-bold shrink-0">X-Content-Job-Id</span>
                  <div>
                    <p className="font-semibold text-stone-800">ID GeneratedMedia — selalu ada untuk video</p>
                    <p className="text-stone-500">Cocokkan dengan <code className="bg-stone-100 px-1 rounded">id</code> dari response GET job — jamin file yang didownload milik job yang dipoll.</p>
                  </div>
                </div>
                <div className="flex gap-3 p-3 bg-stone-50 border border-stone-200 rounded-lg">
                  <span className="text-stone-600 font-mono font-bold shrink-0">X-Content-Client-Ref</span>
                  <div>
                    <p className="font-semibold text-stone-800">Client reference — hanya ada jika diset saat submit</p>
                    <p className="text-stone-500">Sama dengan <code className="bg-stone-100 px-1 rounded">clientRef</code> dari POST request. Berguna untuk mapping parallel jobs ke creative slot.</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-stone-500 mt-3">
                Contoh: <code className="bg-stone-100 px-1 rounded">curl -I &quot;{BASE}/api/photos/serve/videos/xxx.mp4&quot;</code> → lihat header response.
                <br />Hanya untuk video (<code className="bg-stone-100 px-1 rounded">Content-Type: video/mp4</code>). File non-video tidak punya identity headers.
              </p>
            </Section>

            <Section title="Task Status Polling (Advanced)">
              <p className="text-sm text-stone-600 mb-2">
                Untuk agen yang ingin track semua task (bukan hanya video):
              </p>
              <Endpoint method="GET" path="/api/gen/tasks" desc="List semua task milik agent. Query: ?status=pending|processing|completed|failed&limit=20&offset=0" />
              <Endpoint method="GET" path="/api/gen/tasks/[id]" desc="Detail satu task + result." />
            </Section>
          </>
        )}

        {/* ── CREDITS ── */}
        {tab === 'credits' && (
          <>
            <Section title="Cek Saldo">
              <Endpoint method="GET" path="/api/gen/credits" desc="Saldo + 10 transaksi terakhir." />
              <div className="mt-3">
                <Code>{`curl -H "x-api-key: hsk_xxx..." \\
  ${BASE}/api/gen/credits

{
  "balance": 2000000,
  "transactions": [
    {
      "amount": -1300,
      "reason": "Video generation",
      "balanceAfter": 998700,
      "createdAt": "2026-06-14T10:00:00Z"
    }
  ]
}`}</Code>
              </div>
            </Section>

            <Section title="Biaya Generate">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="text-left py-2 pr-4 font-semibold text-stone-700">Tipe</th>
                      <th className="text-left py-2 pr-4 font-semibold text-stone-700">Durasi</th>
                      <th className="text-left py-2 font-semibold text-stone-700">Biaya</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    <tr><td className="py-2 pr-4 text-stone-600">SD</td><td className="py-2 pr-4 text-stone-600">6 detik</td><td className="py-2 font-mono text-stone-800">1.000 kredit</td></tr>
                    <tr><td className="py-2 pr-4 text-stone-600">SD</td><td className="py-2 pr-4 text-stone-600">10 detik</td><td className="py-2 font-mono text-stone-800">1.300 kredit</td></tr>
                    <tr><td className="py-2 pr-4 text-stone-600">HD</td><td className="py-2 pr-4 text-stone-600">6 detik</td><td className="py-2 font-mono text-stone-800">2.000 kredit</td></tr>
                    <tr><td className="py-2 pr-4 text-stone-600">HD</td><td className="py-2 pr-4 text-stone-600">10 detik</td><td className="py-2 font-mono text-stone-800">2.600 kredit</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-stone-500 mt-3">
                Biaya dihitung server-side dan tidak bisa di-override dari request. Saldo dipotong saat job submit, dikembalikan otomatis jika gagal.
              </p>
            </Section>

            <Section title="Top-up Saldo">
              <p className="text-sm text-stone-600">
                Top-up dilakukan oleh admin. Hubungi admin dengan menyebut <strong>email akun</strong> dan jumlah kredit yang dibutuhkan.
              </p>
            </Section>
          </>
        )}

        {/* ── LIBRARY ── */}
        {tab === 'library' && (
          <>
            <Section title="GET /api/hermes/library">
              <p className="text-sm text-stone-600 mb-2">
                Untuk agent konten yang di-assign ke akun IG tertentu. Auth: <strong>Bearer token</strong> (bukan x-api-key — ini key terpisah untuk content agent, minta ke admin).
                Response selalu difilter berdasarkan assignment agent.
              </p>
              <p className="text-xs text-stone-500 mb-3">
                <strong>Persona sudah embedded langsung di setiap instagramAccount</strong> — tidak ada array characters[] terpisah.
              </p>
              <Code>{`curl -H "Authorization: Bearer hsl_content_xxx..." \\
  ${BASE}/api/hermes/library

{
  "agent": { "id": "...", "name": "Agent Konten" },
  "library": {
    "instagramAccounts": [
      {
        "id": "acc_xxx",
        "username": "budi_official",
        "gender": "F",
        "characterDescription": "Ibu rumah tangga 30an...",
        "behavior": "Santai, hangat, relatable",
        "speakingStyle": "Casual, sering pakai kata aku",
        "expressionStyle": "Ekspresif, sering tersenyum",
        "movementStyle": "Gerakan natural",
        "forbiddenRules": "Jangan sebut kompetitor",
        "photoReferences": [
          {
            "id": "...",
            "fileUrl": "https://ai.boytenggara.com/api/photos/serve/...",
            "label": "Foto referensi 1",
            "category": "portrait"
          }
        ]
      }
    ],
    "ceps": [...],
    "products": [
      {
        "id": "...", "name": "...",
        "landingPages": [
          { "url": "https://...", "variant": "A", "isDefault": true }
        ]
      }
    ],
    "mediaAssets": [
      { "type": "VIDEO", "fileUrl": "https://...", "duration": 23.5, "aspectRatio": "9:16" }
    ]
  }
}`}</Code>
            </Section>

            <Section title="Endpoint Library Lain">
              <Endpoint method="GET" path="/api/hermes/ready-upload" desc="Akun berikutnya yang siap di-post" />
              <Endpoint method="GET" path="/api/hermes/photos" desc="Foto referensi assigned" />
              <Endpoint method="GET" path="/api/hermes/ceps" desc="CEP assigned" />
              <Endpoint method="GET" path="/api/hermes/generated-media" desc="Video yang sudah selesai dan di-assign ke agent ini" />
            </Section>
          </>
        )}

        {/* ── CONTENT ── */}
        {tab === 'content' && (
          <>
            <Section title="Submit Hasil Konten">
              <p className="text-sm text-stone-600 mb-2">Untuk content agent (Bearer token).</p>
              <Endpoint method="POST" path="/api/hermes/content-log" desc="Log hasil generate/post. Body: accountId, topicId?, cepId?, contentType, caption, mediaUrl, postUrl..." />
              <Endpoint method="POST" path="/api/hermes/cep-feedback" desc="Submit CEP baru untuk review admin. Body: { topicId, cepText, painPoint?, angle? }" />
            </Section>
            <Section title="Produk & Landing Pages">
              <p className="text-sm text-stone-600 mb-2">
                Produk di library response include <code className="text-xs bg-stone-100 px-1 rounded">landingPages[]</code> —
                pakai LP dengan <code className="text-xs bg-stone-100 px-1 rounded">isDefault: true</code> untuk CTA default,
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
                Rate limit 120 req/menit.
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
            </Section>
          </>
        )}

        {/* ── ADMIN ── */}
        {tab === 'admin' && (
          <>
            <Section title="Catatan">
              <p className="text-sm text-stone-600">
                Semua endpoint admin pakai session cookie (login dulu via browser). Data difilter per ownership.
              </p>
            </Section>
            <Section title="Auth">
              <Endpoint method="POST" path="/api/admin/auth/login" desc="Body: { email, password }" />
              <Endpoint method="GET" path="/api/admin/auth/google" desc="Redirect ke Google OAuth" />
              <Endpoint method="POST" path="/api/admin/auth/logout" desc="Hapus session" />
              <Endpoint method="GET" path="/api/admin/meta-oauth/start" desc="Mulai Meta OAuth (Connect Facebook)" />
            </Section>
            <Section title="Credits">
              <Endpoint method="POST" path="/api/admin/credits/grant" desc="Grant kredit ke user. Body: { userId? (default: self), amount, reason? }. Auth: admin only." />
            </Section>
            <Section title="Landing Pages & Stats">
              <Endpoint method="GET" path="/api/admin/products/[id]/landing-pages" desc="List LP per produk" />
              <Endpoint method="POST" path="/api/admin/products/[id]/landing-pages" desc="Tambah LP variant" />
              <Endpoint method="PATCH" path="/api/admin/landing-pages/[lpId]" desc="Update / set default / pause" />
              <Endpoint method="GET" path="/api/admin/landing-pages/[lpId]/stats" desc="Stats + summary (clicks, conversions, CR, revenue)" />
            </Section>
            <Section title="Automation Rules">
              <Endpoint method="GET" path="/api/admin/automation-rules" desc="List rules" />
              <Endpoint method="POST" path="/api/admin/automation-rules" desc="Buat rule" />
              <Endpoint method="POST" path="/api/admin/automation-rules/dry-run" desc="Preview: entity mana yang match" />
              <Endpoint method="GET" path="/api/admin/rule-templates" desc="Template builtin + custom" />
            </Section>
            <Section title="Instagram Accounts">
              <Endpoint method="GET" path="/api/admin/accounts" desc="List akun IG. Query: ?status=active" />
              <Endpoint method="POST" path="/api/admin/accounts" desc="Buat akun + persona" />
              <Endpoint method="GET" path="/api/admin/accounts/[id]" desc="Detail + photoReferences + persona fields" />
              <Endpoint method="PATCH" path="/api/admin/accounts/[id]" desc="Update termasuk persona fields" />
            </Section>
            <Section title="Meta Tools">
              <Endpoint method="GET" path="/api/admin/meta-audiences" desc="List custom + lookalike audiences" />
              <Endpoint method="POST" path="/api/admin/meta-audiences" desc="Buat audience" />
              <Endpoint method="GET" path="/api/admin/meta-catalogs" desc="List catalogs" />
              <Endpoint method="GET" path="/api/admin/capi-configs" desc="List CAPI configs" />
              <Endpoint method="POST" path="/api/admin/capi-configs" desc="Buat config (pixelId + token)" />
            </Section>
          </>
        )}

        {/* ── WORKERS ── */}
        {tab === 'workers' && (
          <>
            <Section title="Worker Task Queue">
              <p className="text-sm text-stone-600 mb-3">
                Untuk <strong>worker agent</strong> yang mengerjakan task async (generate video, photo, caption, post).
                Auth: <strong>Bearer worker key</strong> (berbeda dari content agent key — minta ke admin).
              </p>
              <p className="text-xs text-stone-500 mb-3">
                Task types yang tersedia: <code className="bg-stone-100 px-1 rounded">GENERATE_VIDEO</code>, <code className="bg-stone-100 px-1 rounded">GENERATE_PHOTO</code>, <code className="bg-stone-100 px-1 rounded">CAPTION_ONLY</code>, <code className="bg-stone-100 px-1 rounded">POST_CONTENT</code>, <code className="bg-stone-100 px-1 rounded">REFRESH_CREATIVE</code>, <code className="bg-stone-100 px-1 rounded">CEP_GENERATION</code>
              </p>
              <Endpoint method="GET" path="/api/hermes/tasks" desc="Ambil task pending. Query: ?types=GENERATE_VIDEO,GENERATE_PHOTO (opsional, filter tipe). Response: { tasks: [{id, type, payload, ...}] }" />
              <Endpoint method="POST" path="/api/hermes/tasks" desc="Claim task (tandai sebagai processing). Body: { taskId }. Response: { task }" />
              <Endpoint method="POST" path="/api/hermes/tasks/[id]" desc="Update hasil task. Body: { action: 'complete' | 'fail', result?: {...}, error?: string, mediaAsset?: {...} }" />
            </Section>

            <Section title="Flow Worker Agent">
              <Code>{`# 1. Ambil task pending
curl -H "Authorization: Bearer hsl_worker_xxx" \
  ${BASE}/api/hermes/tasks?types=GENERATE_VIDEO

# Response
{ "tasks": [{ "id": "task_xxx", "type": "GENERATE_VIDEO", "payload": {...} }] }

# 2. Claim task (tandai processing)
curl -X POST -H "Authorization: Bearer hsl_worker_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "task_xxx" }' \
  ${BASE}/api/hermes/tasks

# 3. Kerjakan task... lalu report hasilnya
curl -X POST -H "Authorization: Bearer hsl_worker_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "action": "complete", "result": { "videoUrl": "https://..." } }' \
  ${BASE}/api/hermes/tasks/task_xxx

# Atau kalau gagal:
curl -X POST -H "Authorization: Bearer hsl_worker_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "action": "fail", "error": "GeminiGen timeout" }' \
  ${BASE}/api/hermes/tasks/task_xxx`}</Code>
            </Section>
          </>
        )}

        {/* ── CPAS ── */}
        {tab === 'cpas' && (
          <>
            <Section title="CPAS Agent — Overview">
              <p className="text-sm text-stone-600 mb-2">
                Endpoint untuk agent yang mengelola CPAS (Shopee collaborative ads): cek slot, spawn adset baru, log hasil kill, tulis diary & lesson.
                Auth: <strong>Bearer content agent key</strong> (sama dengan /api/hermes/library).
              </p>
              <p className="text-xs text-stone-500">
                Semua response difilter per agent. Campaign harus mengandung kata "hermes" (case-insensitive) agar bisa di-spawn.
              </p>
            </Section>

            <Section title="Spawn Flow">
              <Code>{`# 1. Cek slot tersedia di campaign
GET /api/hermes/cpas/slot-count?campaignSessionId=sess_xxx
→ { cap, activeAdsets, inProcess, freeSlots, metaCampaignId }

# 2. Buat spawn job (buat CEP + WorkerTask sekaligus)
POST /api/hermes/cpas/spawn-job
Body: {
  userId, productKey, campaignSessionId,
  cepData: { painText, exchangeValue, deliveryStyle, hookDirection, adsetNaming, cepText },
  referencePhotoUrl?, productId?
}
→ { jobId, cepId, taskId, stage: "plan" }

# 3. Poll status
GET /api/hermes/cpas/spawn-job/[jobId]
→ { id, status, stage, resultJson, createdAt, completedAt }

# Stages: plan → image_submitted → images_ready → adset_written

# 4. Update stage saat progress
PATCH /api/hermes/cpas/spawn-job/[jobId]
Body: { status: "processing", stage: "image_submitted", resultJson?: {...} }
# Stage hanya bisa maju, tidak bisa mundur`}</Code>
            </Section>
            <Section title="Knowledge Endpoints">
              <Endpoint method="GET" path="/api/hermes/cpas/slot-count" desc="Cek slot spawn tersedia. Query: campaignSessionId (wajib). Response: { cap, activeAdsets, inProcess, freeSlots }" />
              <Endpoint method="POST" path="/api/hermes/cpas/spawn-job" desc="Buat spawn job baru (CEP + WorkerTask atomik). Lihat flow di atas." />
              <Endpoint method="GET" path="/api/hermes/cpas/spawn-job/[id]" desc="Poll status + stage label spawn job" />
              <Endpoint method="PATCH" path="/api/hermes/cpas/spawn-job/[id]" desc="Update stage / status. Stage hanya maju (plan → image_submitted → images_ready → adset_written)" />
              <Endpoint method="GET" path="/api/hermes/cpas/graveyard" desc="List adset yang pernah di-kill. Query: productKey?, killTier?, since?, limit?" />
              <Endpoint method="POST" path="/api/hermes/cpas/graveyard" desc="Log adset yang baru di-kill. Body: { metaAdsetId, adsetName, productKey, killTier, killReason, spendAtKill, catalogROASAtKill?, cplcAtKill? }" />
              <Endpoint method="GET" path="/api/hermes/cpas/diary" desc="List diary entry. Query: productKey?, limit?" />
              <Endpoint method="POST" path="/api/hermes/cpas/diary" desc="Tulis diary entry. Body: { period, productKey?, killedThisRun?, spawnedThisRun?, avgROAS7d?, summaryText? }" />
              <Endpoint method="GET" path="/api/hermes/cpas/lessons" desc="List lessons yang sudah diarsip" />
              <Endpoint method="POST" path="/api/hermes/cpas/lessons" desc="Submit lesson. Body: { productKey, lessonText, sourceType?, sourceId? }" />
              <Endpoint method="GET" path="/api/hermes/cpas/pain-library" desc="Ambil pain entries aktif. Query: productKey?" />
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
