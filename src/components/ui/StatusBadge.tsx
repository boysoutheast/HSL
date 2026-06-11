import React from 'react'

interface StatusBadgeProps {
  status: string
}

const statusMap: Record<string, string> = {
  active: 'badge-active',
  inactive: 'badge-inactive',
  pending: 'badge-pending',
  error: 'badge-error',
  READY_UPLOAD: 'badge-ready',
  STILL_GROWING: 'badge-growing',
  HOT_VIDEO: 'badge-hot',
  NEED_NEW_VIDEO: 'badge-inactive',
  WAITING: 'badge-inactive',
  ERROR: 'badge-error',
  pending_review: 'badge-pending',
  rejected: 'badge-error',
  monitoring: 'badge-monitoring',
  connected: 'badge-connected',
  expired: 'badge-expired',
  reconnect_needed: 'badge-reconnect',
  revoked: 'badge-revoked',
  READY: 'badge-ready',
  PROCESSING: 'badge-monitoring',
  FAILED: 'badge-error',
  DRAFT: 'badge-inactive',
}

const statusLabel: Record<string, string> = {
  READY_UPLOAD: 'Ready Upload',
  STILL_GROWING: 'Growing',
  HOT_VIDEO: 'Hot 🔥',
  NEED_NEW_VIDEO: 'Need Video',
  WAITING: 'Waiting',
  ERROR: 'Error',
  pending_review: 'Pending Review',
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  error: 'Error',
  monitoring: 'Monitoring',
  rejected: 'Rejected',
  connected: 'Connected',
  expired: 'Expired',
  reconnect_needed: 'Reconnect',
  revoked: 'Revoked',
  READY: 'Ready',
  PROCESSING: 'Processing',
  FAILED: 'Failed',
  DRAFT: 'Draft',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const className = statusMap[status] ?? 'badge-inactive'
  const label = statusLabel[status] ?? status

  return <span className={className}>{label}</span>
}
