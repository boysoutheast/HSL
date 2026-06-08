'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AssignmentsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/agents') }, [router])
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Redirecting to Agents...
    </div>
  )
}
