'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface MetaChatMessage {
  id: string
  messageMetaId: string
  body: string | null
  direction: 'inbound' | 'outbound'
  senderMetaId: string | null
  senderName: string | null
  sentAt: string | null
  readAt: string | null
  attachmentJson: string | null
}

interface MetaChatThread {
  id: string
  threadMetaId: string
  customerName: string | null
  customerMetaId: string | null
  platform: string
  unreadCount: number
  lastMessageAt: string | null
  metaPage: { pageName: string; pageId: string } | null
  metaAccount: { id: string; name: string } | null
  messages: MetaChatMessage[]
}

export default function ChatThreadPage() {
  const params = useParams()
  const router = useRouter()
  const threadId = params.id as string
  const [thread, setThread] = useState<MetaChatThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchThread = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/chat/${threadId}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Conversation not found')
        throw new Error('Failed to fetch conversation')
      }
      const json = await res.json()
      setThread(json.thread)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async () => {
    try {
      await fetch(`/api/admin/chat/${threadId}/read`, { method: 'POST' })
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    fetchThread()
  }, [threadId])

  useEffect(() => {
    if (thread) {
      markAsRead()
      scrollToBottom()
    }
  }, [thread?.messages.length])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/admin/chat/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to send')
      }
      setMessage('')
      fetchThread()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: MetaChatMessage[] }[] = []
  if (thread?.messages) {
    let currentDate = ''
    let currentGroup: MetaChatMessage[] = []
    for (const msg of thread.messages) {
      const msgDate = formatDate(msg.sentAt)
      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groupedMessages.push({ date: currentDate, messages: currentGroup })
        }
        currentDate = msgDate
        currentGroup = [msg]
      } else {
        currentGroup.push(msg)
      }
    }
    if (currentGroup.length > 0) {
      groupedMessages.push({ date: currentDate, messages: currentGroup })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-violet-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="text-violet-600 hover:text-violet-800 text-sm">
          ← Back
        </button>
        <div className="text-center py-12 text-red-600">{error}</div>
      </div>
    )
  }

  if (!thread) return null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-violet-600 hover:text-violet-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="section-title">{thread.customerName ?? 'Unknown Customer'}</h1>
          <p className="text-sm text-stone-500">
            {thread.metaPage?.pageName ?? 'Unknown Page'} · {thread.platform}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="card h-[calc(100vh-280px)] min-h-[400px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {groupedMessages.map((group, gi) => (
            <div key={gi}>
              {/* Date divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs text-stone-400 font-medium">{group.date}</span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>

              {/* Messages for this date */}
              <div className="space-y-3">
                {group.messages.map(msg => {
                  const isOutbound = msg.direction === 'outbound'
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          isOutbound
                            ? 'bg-violet-600 text-white rounded-br-md'
                            : 'bg-stone-100 text-stone-800 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isOutbound ? 'text-violet-200' : 'text-stone-400'
                          }`}
                        >
                          {formatTime(msg.sentAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="border-t border-stone-200 p-4 flex gap-3">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="input-field flex-1"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!message.trim() || sending}
            className="btn-primary disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
