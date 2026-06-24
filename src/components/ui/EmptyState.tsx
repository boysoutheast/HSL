import React from 'react'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-4xl mb-4">{icon}</div>}
      <h3 className="text-base font-semibold text-stone-700">{title}</h3>
      {description && (
        <p className="text-sm text-stone-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && (
        <>
          {action.href ? (
            <a
              href={action.href}
              className="mt-4 btn-primary"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="mt-4 btn-primary"
            >
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  )
}
