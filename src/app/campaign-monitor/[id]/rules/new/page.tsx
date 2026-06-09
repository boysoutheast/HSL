import Link from 'next/link'

export default function NewRulePage() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href=".." className="text-stone-400 hover:text-stone-600 text-sm">← Back to Campaign</Link>
      </div>
      <div className="bg-white rounded border border-stone-300 px-6 py-8 flex flex-col items-center justify-center text-center">
        <svg className="w-12 h-12 text-stone-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <h1 className="text-xl font-bold text-stone-800 mb-2">Add Automation Rule</h1>
        <p className="text-sm text-stone-500 mb-6 max-w-sm">
          Rule builder coming soon. Configure rules with conditions and actions to automate your campaign.
        </p>
        <Link href=".." className="btn-ghost">← Back to Campaign</Link>
      </div>
    </div>
  )
}
