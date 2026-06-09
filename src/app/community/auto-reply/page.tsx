import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'

const rules = [
  { id: '1', name: 'Harga Tanya → Auto Balas', trigger: 'contain:harga|berapa|berapa rupiah', reply: 'Halo! Produk kami tersedia mulai Rp75.000. Mau info lebih lanjut?', platform: 'Facebook', status: 'active', matchCount: 34 },
  { id: '2', name: 'Kirim → Lokasi → Auto Balas', trigger: 'contain:kirim|ke jakarta|ke bandung', reply: 'Kami kirim ke seluruh Indonesia via JNE/SiCepat. Ongkir starts from Rp12.000!', platform: 'Facebook', status: 'active', matchCount: 18 },
  { id: '3', name: 'Wangi → Testimoni Positive', trigger: 'sentiment:positive,wangi|enak|bagus', reply: 'Terima kasih! Senang produk kami cocok untuk kulit Anda. Bisa share review di Google ya!', platform: 'Both', status: 'active', matchCount: 56 },
  { id: '4', name: 'PROMO Mention → Diskon', trigger: 'contain:promo|diskon|kode promo', reply: 'Follow kami untuk update promo terbaru! Setiap bulan ada program affiliate juga lho 😊', platform: 'Instagram', status: 'paused', matchCount: 5 },
  { id: '5', name: 'Banded/Recalled Product', trigger: 'contain:jelek|tidak cocok|alergi', reply: 'Mohon maaf jika kurang nyaman. Silakan hubungi DM kami untuk komplain dan kompensasi.', platform: 'Both', status: 'active', matchCount: 2 },
]

export default function AutoReplyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Auto Reply Rules</h1>
          <p className="section-sub">Set AI-powered automatic replies triggered by comment content or sentiment.</p>
        </div>
        <a href="/community/auto-reply/new" className="btn-primary">
          + New Rule
        </a>
      </div>

      <PageInfo
        purpose="Create rules that automatically reply to comments matching specific keywords, phrases, or sentiment patterns. Uses Hermes AI to generate smart, brand-appropriate responses."
        inputs={['Rule name', 'Trigger (keyword/phrase/sentiment)', 'Reply text or AI generation', 'Platform (Facebook/Instagram/Both)', 'CEP/character to use']}
        wiring={[
          { label: 'CEP', desc: 'Response tone and style — pick which character/CEP generates the reply' },
          { label: 'AI Model', desc: 'GPT-4o mini for fast auto-replies, GPT-4o for complex queries' },
          { label: 'Fallback', desc: 'If no rule matches, flag as pending for manual review' },
        ]}
      />

      <div className="card">
        <Table
          headers={['Rule Name', 'Trigger', 'Platform', 'Status', 'Matches']}
        >
          {rules.map(r => (
            <tr key={r.id}>
              <td className="px-4 py-3"><a href={`/community/auto-reply/${r.id}`} className="text-violet-700 hover:underline font-medium">{r.name}</a></td>
              <td className="px-4 py-3"><code className="text-xs bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded max-w-[200px] truncate block">{r.trigger}</code></td>
              <td className="px-4 py-3">{r.platform}</td>
              <td className="px-4 py-3"><span className={`badge-${r.status === 'active' ? 'active' : 'inactive'}`}>{r.status}</span></td>
              <td className="px-4 py-3">{r.matchCount}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
