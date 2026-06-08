import React from 'react'

interface StatusBadgeProps {
  status: string
}

const statusMap: Record<string, string> = {
  // Generic
  active: 'badge-active',
  inactive: 'badge-inactive',
  pending: 'badge-pending',
  error: 'badge-error',

  // PostingMonitor statuses
  READY_UPLOAD: 'badge-ready',
  STILL_GROWING: 'badge-growing',
  HOT_VIDEO: 'badge-hot',
  NEED_NEW_VIDEO: 'badge-inactive',
  WAITING: 'badge-inactive',
  ERROR: 'badge-error',

  // CEP statuses
  pending_review: 'badge-pending',
  rejected: 'badge-error',

  // Hermes Agent statuses
  monitoring: 'badge-monitoring',
}

const statusLabel: Record<string, string> = {
  READY_UPLOAD: 'Ready Upload',
  STILL_GROWING: 'Still Growing',
  HOT_VIDEO: 'Hot Video',
  NEED_NEW_VIDEO: 'Need New Video',
  WAITING: 'Waiting',
  ERROR: 'Error',
  pending_review: 'Pending Review',
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  error: 'Error',
  monitoring: 'Monitoring',
  rejected: 'Rejected',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const className = statusMap[status] ?? 'badge-inactive'
  const label = statusLabel[status] ?? status

  return <span className={className}>{label}</span>
}
