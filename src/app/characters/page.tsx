import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'

interface Character {
  id: string
  name: string
  description: string
  status: string
  speakingStyle: string | null
  expressionStyle: string | null
  createdAt: string
  instagramAccount: {
    id: string
    username: string
  }
  _count?: {
    topics: number
    photoReferences: number
  }
}

async function getCharacters(): Promise<Character[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${base}/api/admin/characters`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function CharactersPage() {
  const characters = await getCharacters()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Characters</h1>
          <p className="text-sm text-gray-500 mt-0.5">{characters.length} character{characters.length !== 1 ? 's' : ''} total</p>
        </div>
        <button className="btn-primary">+ Add Character</button>
      </div>

      <PageInfo
        purpose="Persona yang dimainkan Hermes saat bikin konten. Satu akun bisa punya beberapa karakter untuk variasi konten."
        inputs={[
          'Nama karakter (misal: Ibu Caring)',
          'Deskripsi: usia, penampilan, background',
          'Behavior: cara bergerak dan bereaksi di video',
          'Speaking style: cara bicara dan pilihan kata',
          'Expression & movement style',
          'Forbidden rules: hal yang tidak boleh dilakukan karakter ini',
        ]}
        wiring={[
          { label: '← Instagram Account', desc: 'character harus terikat ke 1 akun' },
          { label: '→ Photo Reference', desc: 'foto referensi untuk karakter ini' },
          { label: '→ Topic', desc: 'topik bahasan yang dipegang karakter' },
          { label: '→ Hermes API', desc: 'dikirim dalam /api/hermes/library' },
        ]}
      />

      <Table
        headers={['Name', 'Account', 'Status', 'Description', 'Speaking Style', 'Topics', 'Photos']}
        empty="No characters found."
      >
        {characters.map((char) => (
          <tr key={char.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-4 py-3">
              <p className="font-medium text-gray-900">{char.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(char.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </td>
            <td className="px-4 py-3 text-indigo-700 font-medium">
              @{char.instagramAccount.username}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={char.status} />
            </td>
            <td className="px-4 py-3 text-gray-500 max-w-[240px]">
              <p className="truncate">{char.description}</p>
            </td>
            <td className="px-4 py-3 text-gray-500 max-w-[180px]">
              <p className="truncate">{char.speakingStyle ?? '—'}</p>
            </td>
            <td className="px-4 py-3 text-gray-600">
              {char._count?.topics ?? '—'}
            </td>
            <td className="px-4 py-3 text-gray-600">
              {char._count?.photoReferences ?? '—'}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
