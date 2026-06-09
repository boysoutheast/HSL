import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'

const spamRules = [
  { id: '1', name: 'Block Competitor Links', pattern: 'contain:gl抬.com|scincare.xyz|bodylotionmurah.id', action: 'delete', count: 3 },
  { id: '2', name: 'Block External Shop Links', pattern: 'contain:tokopedia.com|shopee.co.id|blibli.com', action: 'delete', count: 12 },
  { id: '3', name: 'Block Spam Characters', pattern: 'char_count:>200', action: 'delete', count: 7 },
  { id: '4', name: 'Block Adult Content', pattern: 'contain:18+|adult|+62 scam|bit.ly', action: 'hide', count: 1 },
  { id: '5', name: 'Flag Competitor Mention', pattern: 'contain:wardah|somethinc|em COSRX', action: 'flag_manual', count: 2 },
]

export default function SpamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Spam Rules</h1>
          <p className="section-sub">Auto-delete or hide spam, competitor mentions, and malicious links.</p>
        </div>
        <a href="/community/spam/new" className="btn-primary">
          + New Rule
        </a>
      </div>

      <PageInfo
        purpose="Protect your Page from spam, competitor promotion, malicious links, and abusive content. Rules run automatically before comments reach the public."
        inputs={['Pattern (keyword/regex/character count)', 'Action (delete/hide/flag)', 'Platform scope']}
      />

      <div className="card">
        <Table
          headers={['Rule Name', 'Pattern', 'Action', 'Deleted/Hidden']}
        >
          {spamRules.map(s => (
            <tr key={s.id}>
              <td className="px-4 py-3"><span className="font-medium">{s.name}</span></td>
              <td className="px-4 py-3"><code className="text-xs bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded max-w-[250px] truncate block">{s.pattern}</code></td>
              <td className="px-4 py-3"><span className={`badge-${s.action === 'delete' ? 'error' : s.action === 'hide' ? 'inactive' : 'pending'}`}>{s.action}</span></td>
              <td className="px-4 py-3">{s.count}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
