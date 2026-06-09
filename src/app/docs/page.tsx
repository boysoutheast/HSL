'use client'

import { useState } from 'react'

const BASE = 'https://hermes-support-web-production.up.railway.app'

export default function DocsPage() {
  const [tab, setTab] = useState<'auth' | 'produk' | 'foto' | 'cep'>('produk')

  const tabs = [
    { key: 'auth', label: '🔑 Auth' },
    { key: 'produk', label: '🛍️ Baca Produk' },
    { key: 'foto', label: '🖼️ Ambil Foto' },
    { key: 'cep', label: '💡 CEP' },
  ] as const

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">H</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-stone-900">Hermes API — Panduan Singkat</h1>
            <p className="text-xs text-stone-500">{BASE}/api/hermes/</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Tab navigation */}
        <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-1 mb-6">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === key ? 'bg-violet-600 text-white' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'auth' && <AuthTab />}
        {tab === 'produk' && <ProdukTab />}
        {tab === 'foto' && <FotoTab />}
        {tab === 'cep' && <CepTab />}
      </div>
    </div>
  )
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function AuthTab() {
  return (
    <div className="space-y-4">
      <Card title="API Key">
        <p className="text-sm text-stone-700 mb-3">
          Semua endpoint Hermes memerlukan API Key. Dapatkan dari halaman{' '}
          <strong>Admin → Agents → buat agent → copy API key</strong>.
        </p>
        <Pre>{`Authorization: Bearer YOUR_API_KEY_HERE`}</Pre>
      </Card>
      <Card title="Base URL">
        <Pre>{`${BASE}`}</Pre>
        <p className="text-xs text-stone-500 mt-2">
          Semua endpoint dimulai dengan:{' '}
          <code className="bg-stone-100 px-1 rounded">/api/hermes/</code>
        </p>
      </Card>
      <Card title="Response jika tidak ada / salah API key">
        <Pre>{`HTTP 401
{ "error": "Missing authorization" }
{ "error": "Invalid or inactive API key" }`}</Pre>
      </Card>
    </div>
  )
}

// ─── Produk ───────────────────────────────────────────────────────────────────

function ProdukTab() {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <strong>Cara kerja:</strong> Produk yang sudah di-assign ke agent kamu tersedia di endpoint{' '}
        <code className="bg-blue-100 px-1 rounded">/api/hermes/library</code>. Field{' '}
        <code className="bg-blue-100 px-1 rounded">description</code> berisi semua informasi produk
        yang kamu butuhkan untuk generate konten.
      </div>

      <Card title="GET /api/hermes/library — Ambil semua produk">
        <Pre>{`GET ${BASE}/api/hermes/library
Authorization: Bearer YOUR_API_KEY`}</Pre>
        <p className="text-sm text-stone-600 mt-3 mb-2">Response — bagian products:</p>
        <Pre>{`{
  "library": {
    "products": [
      {
        "id": "clprod123",
        "name": "Taracare Diabe Lotion",
        "description": "Body lotion untuk kulit kering. Mengandung urea 10% dan aloe vera. Cocok untuk penderita diabetes dengan kulit sensitif. Gunakan 2x sehari setelah mandi.",
        "price": "75000",
        "shopeeUrl": "https://s.shopee.co.id/6Ai6QHAe9x",
        "mainBenefit": "Melembabkan kulit kering dalam 3 hari",
        "status": "active",
        "photoReferences": [
          {
            "id": "clphoto456",
            "fileUrl": "https://hermes-support-web-production.up.railway.app/api/photos/serve/photos/uuid.jpg",
            "label": "Product shot depan",
            "category": "product"
          }
        ]
      }
    ]
  }
}`}</Pre>
        <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">
          💡 <strong>
            Gunakan field <code className="bg-green-100 px-1 rounded">description</code> sebagai konteks utama.
          </strong>{' '}
          Isi selengkap mungkin di admin (nama, manfaat, kandungan, cara pakai, target audience).
          Semakin lengkap deskripsi, semakin bagus konten yang bisa dihasilkan Hermes.
        </div>
      </Card>
    </div>
  )
}

// ─── Foto ─────────────────────────────────────────────────────────────────────

function FotoTab() {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <strong>Cara kerja:</strong> Foto tersedia di dua tempat — sudah ikut serta di response{' '}
        <code className="bg-blue-100 px-1 rounded">/library</code> (di field{' '}
        <code className="bg-blue-100 px-1 rounded">photoReferences</code>), atau bisa fetch langsung
        per produk/karakter.
      </div>

      <Card title="Opsi A — Foto sudah ada di /library">
        <p className="text-sm text-stone-600 mb-2">
          Setiap produk dan karakter di response /library sudah include array{' '}
          <code className="bg-stone-100 px-1 rounded">photoReferences</code>. Gunakan langsung.
        </p>
        <Pre>{`// Dari response /library:
product.photoReferences[0].fileUrl
// → "https://hermes-support-web-production.up.railway.app/api/photos/serve/photos/uuid.jpg"

// Download fotonya:
const res = await fetch(fileUrl)
const buffer = await res.arrayBuffer()`}</Pre>
      </Card>

      <Card title="Opsi B — GET /api/hermes/photos (fetch per entitas)">
        <p className="text-sm text-stone-600 mb-2">
          Kalau butuh foto spesifik untuk satu produk atau karakter:
        </p>
        <Pre>{`// Foto produk:
GET ${BASE}/api/hermes/photos?productId=clprod123
Authorization: Bearer YOUR_API_KEY

// Foto karakter:
GET ${BASE}/api/hermes/photos?characterId=clchar456
Authorization: Bearer YOUR_API_KEY`}</Pre>
        <p className="text-sm text-stone-600 mt-3 mb-2">Response:</p>
        <Pre>{`{
  "photos": [
    {
      "id": "clphoto456",
      "fileUrl": "https://hermes-support-web-production.up.railway.app/api/photos/serve/photos/uuid.jpg",
      "label": "Product shot depan",
      "category": "product",
      "createdAt": "2026-05-28T10:00:00.000Z"
    }
  ],
  "count": 1
}`}</Pre>
        <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">
          💡 <code className="bg-green-100 px-1 rounded">fileUrl</code> adalah URL absolut — langsung
          bisa di-fetch/download. Gunakan sebagai referensi visual saat generate gambar konten.
        </div>
      </Card>
    </div>
  )
}

// ─── CEP ──────────────────────────────────────────────────────────────────────

function CepTab() {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <strong>CEP (Customer Entry Point)</strong> — kalimat pembuka konten yang menyentuh pain point.
        Hermes membaca CEP yang aktif, dan bisa langsung menulis CEP baru yang otomatis aktif.
      </div>

      <Card title="READ — GET /api/hermes/ceps">
        <p className="text-sm text-stone-600 mb-2">Ambil semua CEP aktif untuk topik atau produk tertentu:</p>
        <Pre>{`// Semua CEP dari produk/topik yang di-assign ke kamu:
GET ${BASE}/api/hermes/ceps
Authorization: Bearer YOUR_API_KEY

// Filter by produk:
GET ${BASE}/api/hermes/ceps?productId=clprod123
Authorization: Bearer YOUR_API_KEY

// Filter by topik:
GET ${BASE}/api/hermes/ceps?topicId=cltopic123
Authorization: Bearer YOUR_API_KEY

// Dengan pagination:
GET ${BASE}/api/hermes/ceps?limit=50&offset=0
Authorization: Bearer YOUR_API_KEY`}</Pre>
        <p className="text-sm text-stone-600 mt-3 mb-2">Query parameters (opsional):</p>
        <table className="w-full text-xs border-collapse mb-3">
          <thead>
            <tr className="bg-stone-50">
              <th className="text-left p-2 border border-stone-200">Parameter</th>
              <th className="text-left p-2 border border-stone-200">Type</th>
              <th className="text-left p-2 border border-stone-200">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {([
              ['productId', 'string', 'Filter CEP by produk tertentu'],
              ['topicId',   'string', 'Filter CEP by topik tertentu'],
              ['limit',     'number', 'Max hasil (default: 100, max: 200)'],
              ['offset',    'number', 'Skip N hasil — untuk pagination'],
            ] as [string, string, string][]).map(([p, t, d]) => (
              <tr key={p}>
                <td className="p-2 border border-stone-200 font-mono">{p}</td>
                <td className="p-2 border border-stone-200 text-stone-500">{t}</td>
                <td className="p-2 border border-stone-200">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm text-stone-600 mb-2">Response:</p>
        <Pre>{`{
  "ceps": [
    {
      "id": "clcep789",
      "cepText": "Tumit pecah — malu pakai sandal jepit",
      "painPoint": "Social embarrassment",
      "angle": "fear",
      "source": "human",
      "status": "active",
      "createdByHermesId": null,
      "topicId": null,
      "productId": "clprod123",
      "topic": null,
      "product": { "name": "Lotion Diabetes" }
    }
  ],
  "total": 19,
  "limit": 100,
  "offset": 0
}`}</Pre>
        <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">
          ✅ Return <strong>semua</strong> CEP active dari produk/topik yang di-assign — baik yang
          dibuat manual (human) maupun oleh Hermes (ai). Field{' '}
          <code className="bg-green-100 px-1 rounded">total</code> adalah jumlah keseluruhan
          (sebelum pagination).
        </div>
      </Card>

      <Card title="WRITE — POST /api/hermes/ceps">
        <p className="text-sm text-stone-600 mb-2">
          Ketika kamu menemukan hook yang bagus, simpan ke sistem — langsung aktif, tidak perlu review:
        </p>
        <Pre>{`POST ${BASE}/api/hermes/ceps
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "topicId": "cltopic123",
  "cepText": "Udah 3 bulan nyoba semua produk tapi kulit tetap kusam? Ini yang mungkin kamu skip.",
  "angle": "curiosity"
}`}</Pre>
        <p className="text-sm text-stone-600 mt-3 mb-2">Field yang tersedia:</p>
        <table className="w-full text-xs border-collapse mb-3">
          <thead>
            <tr className="bg-stone-50">
              <th className="text-left p-2 border border-stone-200">Field</th>
              <th className="text-left p-2 border border-stone-200">Wajib</th>
              <th className="text-left p-2 border border-stone-200">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {([
              ['cepText', '✅', 'Kalimat hook-nya — tulis selengkap mungkin'],
              ['topicId', '⚠️ atau productId', 'ID topik yang relevan'],
              ['productId', '⚠️ atau topicId', 'ID produk jika CEP langsung untuk promosi produk'],
              ['angle', '❌', 'fear | curiosity | aspiration | social_proof'],
              ['notes', '❌', 'Catatan tambahan'],
            ] as [string, string, string][]).map(([f, r, d]) => (
              <tr key={f}>
                <td className="p-2 border border-stone-200 font-mono">{f}</td>
                <td className="p-2 border border-stone-200">{r}</td>
                <td className="p-2 border border-stone-200">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pre>{`// Response 201 — berhasil:
{
  "cep": {
    "id": "cep_abc123",
    "cepText": "Udah 3 bulan nyoba semua...",
    "status": "active",
    "source": "ai",
    "createdByHermesId": "agent_xyz"
  },
  "message": "CEP created and active"
}`}</Pre>
        <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">
          💡 CEP yang kamu submit langsung <strong>active</strong> — bisa langsung digunakan di konten
          berikutnya. Field{' '}
          <code className="bg-green-100 px-1 rounded">source: &quot;ai&quot;</code> dan{' '}
          <code className="bg-green-100 px-1 rounded">createdByHermesId</code> otomatis dicatat
          sebagai log bahwa CEP ini dibuat Hermes.
        </div>
      </Card>

      <Card title="DELETE /api/hermes/ceps/:id — Nonaktifkan CEP">
        <p className="text-sm text-stone-600 mb-3">
          Soft-delete sebuah CEP — status diubah ke{' '}
          <code className="bg-stone-100 px-1 rounded text-xs">inactive</code>. Data tidak dihapus
          permanen, tetap tercatat di log.
        </p>
        <Pre>{`curl -X DELETE ${BASE}/api/hermes/ceps/CEP_ID \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</Pre>
        <p className="text-sm text-stone-600 mt-3 mb-2">Response 200:</p>
        <Pre>{`{
  "cep": {
    "id": "cep_abc123",
    "status": "inactive",
    "cepText": "Tumit pecah — malu pakai sandal jepit"
  },
  "message": "CEP deactivated"
}`}</Pre>
        <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
          ⚠️ CEP yang di-deactivate tidak akan muncul di{' '}
          <code className="bg-yellow-100 px-1 rounded">GET /ceps</code> berikutnya. Gunakan ini untuk
          CEP yang sudah tidak relevan atau sudah terlalu banyak dipakai.
        </div>
      </Card>
    </div>
  )
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-stone-800 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">
      {children}
    </pre>
  )
}
