import React from 'react'

interface TableProps {
  headers: string[]
  children: React.ReactNode
  empty?: string
  emptyIcon?: React.ReactNode
}

const DefaultEmptyIcon = (
  <svg className="w-8 h-8 text-stone-300 dark:text-stone-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </svg>
)

export default function Table({ headers, children, empty = 'No records found.', emptyIcon }: TableProps) {
  const isEmpty = React.Children.count(children) === 0

  return (
    <div className="table-wrap">
      <table className="min-w-full divide-y divide-stone-100 dark:divide-stone-800 text-sm">
        <thead>
          <tr className="bg-stone-50 dark:bg-stone-800/60">
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-3 text-left text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80 bg-white dark:bg-stone-900">
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length}>
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-stone-400 dark:text-stone-600">
                  {emptyIcon ?? DefaultEmptyIcon}
                  <p className="text-sm">{empty}</p>
                </div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}
