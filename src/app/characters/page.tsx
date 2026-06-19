'use client'

import { useEffect, useState } from 'react'
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

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/characters', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { characters: [] })
      .then(data => setCharacters(data.characters ?? []))
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Characters</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? 'Loading...' : `${characters.length} character${characters.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <button
          title="Tambah karakter via halaman Account Detail"
          disabled
          className="cursor-not-allowed rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-400"
        >
          + Add Character
        </button>
      </div>

      <PageInfo
        purpose="Persona yang dimainkan AI Buddy saat bikin konten. Satu akun bisa punya beberapa karakter untuk variasi konten."
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

      {loading ? (
        <div className="flex items-center justify-center h-40 text-stone-400 text-sm">Loading characters...</div>
      ) : (
        <Table
          headers={['Name', 'Account', 'Status', 'Description', 'Speaking Style', 'Topics', 'Photos']}
          empty="No characters found. Buat karakter dari halaman Account Detail."
        >
          {characters.map((char) => (
            <tr key={char.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-stone-900">{char.name}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {new Date(char.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </td>
              <td className="px-4 py-3 text-violet-700 font-medium">
                @{char.instagramAccount.username}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={char.status} />
              </td>
              <td className="px-4 py-3 text-stone-500 max-w-[240px]">
                <p className="truncate">{char.description}</p>
              </td>
              <td className="px-4 py-3 text-stone-500 max-w-[180px]">
                <p className="truncate">{char.speakingStyle ?? '—'}</p>
              </td>
              <td className="px-4 py-3 text-stone-600">
                {char._count?.topics ?? '—'}
              </td>
              <td className="px-4 py-3 text-stone-600">
                {char._count?.photoReferences ?? '—'}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
