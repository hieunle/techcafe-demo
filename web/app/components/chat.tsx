'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import styles from './chat.module.css'

/* ── Types ── */
type TextPart = { type: 'text'; text: string }

type ToolCallPart = {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  status: 'calling' | 'done'
  resultCount?: number
}

type MessagePart = TextPart | ToolCallPart

interface Message {
  id: string
  role: 'user' | 'assistant'
  parts: MessagePart[]
}

type Status = 'idle' | 'streaming' | 'error'

/* ── Hook ── */
function useMastraChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (text: string) => {
      setError(null)
      setStatus('streaming')

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text }],
      }
      const assistantId = crypto.randomUUID()
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        parts: [],
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      // Build plain content history for Mastra
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.parts
          .filter((p): p is TextPart => p.type === 'text')
          .map((p) => p.text)
          .join(''),
      }))

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) throw new Error(`Server error ${res.status}`)

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        // accumulate args text per toolCallId
        const argsMap: Record<string, string> = {}

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw || raw === '[DONE]') continue

            let event: { type: string; payload: Record<string, unknown> }
            try {
              event = JSON.parse(raw)
            } catch {
              continue
            }

            const { type, payload } = event

            if (type === 'tool-call-input-streaming-start') {
              const { toolCallId, toolName } = payload as {
                toolCallId: string
                toolName: string
              }
              argsMap[toolCallId] = ''
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        parts: [
                          ...m.parts,
                          {
                            type: 'tool-call',
                            toolCallId,
                            toolName,
                            args: {},
                            status: 'calling',
                          } satisfies ToolCallPart,
                        ],
                      }
                    : m,
                ),
              )
            } else if (type === 'tool-call-delta') {
              const { toolCallId, argsTextDelta } = payload as {
                toolCallId: string
                argsTextDelta: string
              }
              if (toolCallId in argsMap) {
                argsMap[toolCallId] += argsTextDelta
              }
            } else if (type === 'tool-call') {
              const { toolCallId, args } = payload as {
                toolCallId: string
                toolName: string
                args: Record<string, unknown>
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        parts: m.parts.map((p) =>
                          p.type === 'tool-call' && p.toolCallId === toolCallId
                            ? { ...p, args }
                            : p,
                        ),
                      }
                    : m,
                ),
              )
            } else if (type === 'tool-result') {
              const { toolCallId, result } = payload as {
                toolCallId: string
                result: { relevantContext?: unknown[] }
              }
              const count = result?.relevantContext?.length ?? 0
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        parts: m.parts.map((p) =>
                          p.type === 'tool-call' && p.toolCallId === toolCallId
                            ? { ...p, status: 'done', resultCount: count }
                            : p,
                        ),
                      }
                    : m,
                ),
              )
            } else if (type === 'text-delta') {
              const { text: chunk } = (payload as { id: string; text: string })
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m
                  const parts = [...m.parts]
                  const last = parts[parts.length - 1]
                  if (last?.type === 'text') {
                    parts[parts.length - 1] = {
                      ...last,
                      text: last.text + chunk,
                    }
                  } else {
                    parts.push({ type: 'text', text: chunk })
                  }
                  return { ...m, parts }
                }),
              )
            }
          }
        }

        setStatus('idle')
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setStatus('idle')
          return
        }
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        setStatus('error')
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.parts.length === 0)),
        )
      }
    },
    [messages],
  )

  return { messages, status, error, sendMessage }
}

/* ── Tool call card ── */
function ToolCallCard({ part }: { part: ToolCallPart }) {
  const query = (part.args?.queryText as string) ?? ''
  const done = part.status === 'done'

  return (
    <div className={`${styles.toolCard} ${done ? styles.toolCardDone : ''}`}>
      <div className={styles.toolHeader}>
        <span className={styles.toolIcon}>
          {done ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <span className={styles.toolSpinner} />
          )}
        </span>
        <span className={styles.toolName}>
          {done ? 'Searched HR knowledge base' : 'Searching HR knowledge base…'}
        </span>
      </div>
      {query && (
        <div className={styles.toolMeta}>
          <span className={styles.toolMetaLabel}>Query</span>
          <span className={styles.toolMetaValue}>&ldquo;{query}&rdquo;</span>
        </div>
      )}
      {done && part.resultCount !== undefined && (
        <div className={styles.toolMeta}>
          <span className={styles.toolMetaLabel}>Found</span>
          <span className={styles.toolMetaValue}>{part.resultCount} document{part.resultCount !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

/* ── Chat UI ── */
export default function Chat() {
  const { messages, status, error, sendMessage } = useMastraChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const isLoading = status === 'streaming'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    sendMessage(text)
    setInput('')
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.avatar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>HR Knowledge Assistant</h1>
            <p className={styles.subtitle}>Powered by RAG — KMS Policies &amp; Benefits</p>
          </div>
        </div>
      </header>

      <main className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <p className={styles.emptyTitle}>Ask about HR policies</p>
            <p className={styles.emptyHint}>Try: &ldquo;What is the health insurance claim procedure?&rdquo;</p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.messageRow} ${m.role === 'user' ? styles.userRow : styles.assistantRow}`}
          >
            {m.role === 'assistant' && (
              <div className={styles.msgAvatar}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            )}

            <div className={styles.assistantContent}>
              {m.parts.map((part, i) =>
                part.type === 'tool-call' ? (
                  <ToolCallCard key={i} part={part} />
                ) : (
                  <div
                    key={i}
                    className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.assistantBubble}`}
                  >
                    {part.text || (
                      <span className={styles.typing}>
                        <span /><span /><span />
                      </span>
                    )}
                  </div>
                ),
              )}
              {m.role === 'assistant' && m.parts.length === 0 && (
                <div className={`${styles.bubble} ${styles.assistantBubble}`}>
                  <span className={styles.typing}>
                    <span /><span /><span />
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className={styles.errorBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <footer className={styles.footer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about HR policies, benefits, overtime..."
            disabled={isLoading}
            autoFocus
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={isLoading || !input.trim()}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        <p className={styles.footerNote}>
          Mastra · RAG Agent · Answers sourced from HR knowledge base
        </p>
      </footer>
    </div>
  )
}
