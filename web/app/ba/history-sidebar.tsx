'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './history-sidebar.module.css'

interface Thread {
  id: string
  resourceId: string
  title: string
  createdAt: string
  updatedAt: string
}

interface Props {
  activeThreadId: string
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
  refreshKey: number
}

function groupByDate(threads: Thread[]): { label: string; threads: Thread[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000)

  const groups: Record<string, Thread[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  }

  for (const t of threads) {
    const d = new Date(t.updatedAt || t.createdAt)
    if (d >= today) groups['Today'].push(t)
    else if (d >= yesterday) groups['Yesterday'].push(t)
    else if (d >= weekAgo) groups['Previous 7 days'].push(t)
    else groups['Older'].push(t)
  }

  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, threads: list }))
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function threadDisplayTitle(t: Thread): string {
  const raw = (t.title || '').trim()
  if (!raw) return 'Untitled chat'
  const lines = raw.split('\n').filter(Boolean)
  const last = lines[lines.length - 1].trim()
  return last.length > 60 ? last.slice(0, 57) + '…' : last
}

export default function HistorySidebar({ activeThreadId, onSelectThread, onNewChat, refreshKey }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/threads?resourceId=ba-agent')
      if (!res.ok) return
      const data = await res.json()
      const sorted = (data.threads as Thread[]).sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
      )
      setThreads(sorted)
    } catch {
      /* silently ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads, refreshKey])

  const handleDelete = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation()
    try {
      await fetch(`/api/threads/${threadId}`, { method: 'DELETE' })
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
      if (activeThreadId === threadId) onNewChat()
    } catch {
      /* silently ignore */
    }
  }

  const groups = groupByDate(threads)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <button className={styles.newChatBtn} onClick={onNewChat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New chat
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <span className={styles.spinner} />
        </div>
      ) : threads.length === 0 ? (
        <div className={styles.empty}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p className={styles.emptyText}>No conversations yet. Start a new chat to begin.</p>
        </div>
      ) : (
        <div className={styles.threadList}>
          {groups.map((group) => (
            <div key={group.label} className={styles.dateGroup}>
              <p className={styles.dateLabel}>{group.label}</p>
              {group.threads.map((t) => (
                <div
                  key={t.id}
                  className={`${styles.threadItem} ${activeThreadId === t.id ? styles.threadItemActive : ''}`}
                  onClick={() => onSelectThread(t.id)}
                >
                  <div className={styles.threadContent}>
                    <span className={styles.threadTitle}>{threadDisplayTitle(t)}</span>
                    <span className={styles.threadDate}>{formatTime(t.updatedAt || t.createdAt)}</span>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, t.id)}
                    title="Delete conversation"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <p className={styles.footerText}>BA Brainstorm History</p>
      </div>
    </aside>
  )
}
