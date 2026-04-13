'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import styles from './chat.module.css'
import { MarkdownMessage } from './markdown-message'

/* ── Tool helpers ── */
const TOOL_META: Record<string, { label: string; inputKey: string }> = {
  hrKnowledgeTool: { label: 'HR Knowledge Base', inputKey: 'queryText' },
  webSearchTool:   { label: 'Web Search',         inputKey: 'query' },
}

function getToolMeta(toolKey: string) {
  return TOOL_META[toolKey] ?? { label: toolKey, inputKey: 'query' }
}

/* ── Relevant-context renderer (RAG tool output) ── */
interface RelevantDoc {
  pageContent: string
  metadata: Record<string, unknown>
}

function KnowledgeOutput({ docs }: { docs: RelevantDoc[] }) {
  return (
    <div className={styles.toolOutputDocs}>
      <span className={styles.toolOutputSummary}>
        {docs.length} chunk{docs.length !== 1 ? 's' : ''} retrieved
      </span>
      {docs.slice(0, 4).map((doc, i) => (
        <div key={i} className={styles.docChunk}>
          <p className={styles.docSource}>
            {String(doc.metadata?.source ?? doc.metadata?.title ?? `Chunk ${i + 1}`)}
          </p>
          <p className={styles.docSnippet}>
            {doc.pageContent.slice(0, 220)}{doc.pageContent.length > 220 ? '…' : ''}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ── Web-search output renderer (BA tool output) ── */
interface SearchOutput {
  answer?: string
  sources?: { url: string; title: string }[]
  searchCount?: number
}

function SearchOutput({ result }: { result: SearchOutput }) {
  return (
    <div className={styles.toolOutputSearch}>
      {result.answer && <p className={styles.searchAnswer}>{result.answer.slice(0, 300)}{result.answer.length > 300 ? '…' : ''}</p>}
      {(result.sources ?? []).slice(0, 3).map((s, i) => (
        <a key={i} href={s.url} target="_blank" rel="noreferrer" className={styles.searchSource}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          {s.title || s.url}
        </a>
      ))}
    </div>
  )
}

/* ── Tool detail card ── */
type ToolPart = {
  type: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input: Record<string, unknown>
  output?: unknown
  errorText?: string
}

function ToolDetailCard({ part }: { part: ToolPart }) {
  const [expanded, setExpanded] = useState(false)
  const toolKey  = part.type.replace(/^tool-/, '')
  const meta     = getToolMeta(toolKey)
  const isLoading = part.state === 'input-streaming' || part.state === 'input-available'
  const isDone    = part.state === 'output-available'
  const isError   = part.state === 'output-error'
  const query     = (part.input?.[meta.inputKey] as string) ?? ''

  const output = part.output as Record<string, unknown> | undefined

  return (
    <div className={`${styles.toolCard} ${isDone ? styles.toolCardDone : ''} ${isError ? styles.toolCardError : ''}`}>
      {/* Header — always visible */}
      <button
        type="button"
        className={styles.toolHeader}
        onClick={() => (isDone || isError) && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.toolIcon}>
          {isError ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : isDone ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <span className={styles.toolSpinner} />
          )}
        </span>

        <div className={styles.toolHeaderText}>
          <span className={styles.toolName}>{meta.label}</span>
          {query && <span className={styles.toolQuery}>&ldquo;{query}&rdquo;</span>}
          {isError && <span className={styles.toolErrLabel}>Error</span>}
          {isDone && toolKey === 'hrKnowledgeTool' && (
            <span className={styles.toolResultBadge}>
              {((output?.relevantContext ?? []) as RelevantDoc[]).length} chunks
            </span>
          )}
          {isDone && toolKey === 'webSearchTool' && (
            <span className={styles.toolResultBadge}>
              {((output?.sources ?? []) as unknown[]).length} sources
            </span>
          )}
        </div>

        {(isDone || isError) && (
          <span className={styles.toolExpandIcon} aria-hidden>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className={styles.toolBody}>
          {/* Input section */}
          <div className={styles.toolSection}>
            <span className={styles.toolSectionLabel}>Input</span>
            <pre className={styles.toolCode}>{JSON.stringify(part.input, null, 2)}</pre>
          </div>

          {/* Output section */}
          {isDone && (
            <div className={styles.toolSection}>
              <span className={styles.toolSectionLabel}>Output</span>
              {toolKey === 'hrKnowledgeTool' && output?.relevantContext ? (
                <KnowledgeOutput docs={(output.relevantContext as RelevantDoc[])} />
              ) : toolKey === 'webSearchTool' ? (
                <SearchOutput result={output as SearchOutput} />
              ) : (
                <pre className={styles.toolCode}>{JSON.stringify(output, null, 2)}</pre>
              )}
            </div>
          )}

          {isError && (
            <div className={styles.toolSection}>
              <span className={styles.toolSectionLabel}>Error</span>
              <p className={styles.toolErrorText}>{part.errorText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Chat component ── */
interface ChatProps {
  agentId: string
  title: string
  subtitle: string
  color?: string
  placeholder?: string
  emptyTitle?: string
  emptyHint?: string
  icon?: React.ReactNode
}

export default function Chat({
  agentId,
  title,
  subtitle,
  color = 'var(--accent)',
  placeholder = 'Type a message…',
  emptyTitle = 'Start a conversation',
  emptyHint = 'Ask anything to get started.',
  icon,
}: ChatProps) {
  const { messages, sendMessage, stop, status } = useChat({
    transport: new DefaultChatTransport({ api: `/api/agents/${agentId}` }),
  })

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setInput('')
  }

  const defaultIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div
            className={styles.avatar}
            style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
          >
            {icon ?? defaultIcon}
          </div>
          <div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
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
            <p className={styles.emptyTitle}>{emptyTitle}</p>
            <p className={styles.emptyHint}>{emptyHint}</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.messageRow} ${message.role === 'user' ? styles.userRow : styles.assistantRow}`}
          >
            {message.role === 'assistant' && (
              <div
                className={styles.msgAvatar}
                style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
            )}

            <div className={styles.assistantContent}>
              {message.parts.map((part, i) => {
                /* Text bubble */
                if (part.type === 'text') {
                  if (!part.text && message.role === 'assistant') {
                    return (
                      <div key={i} className={`${styles.bubble} ${styles.assistantBubble}`}>
                        <span className={styles.typing}><span /><span /><span /></span>
                      </div>
                    )
                  }
                  if (!part.text) return null
                  return (
                    <div
                      key={i}
                      className={`${styles.bubble} ${message.role === 'user' ? styles.userBubble : styles.assistantBubble}`}
                    >
                      {message.role === 'assistant' ? (
                        <MarkdownMessage content={part.text} accentColor={color} />
                      ) : (
                        part.text
                      )}
                    </div>
                  )
                }

                /* Tool call card */
                if (part.type.startsWith('tool-')) {
                  return <ToolDetailCard key={i} part={part as ToolPart} />
                }

                return null
              })}

              {/* Fallback typing indicator when no parts yet */}
              {message.role === 'assistant' && message.parts.length === 0 && (
                <div className={`${styles.bubble} ${styles.assistantBubble}`}>
                  <span className={styles.typing}><span /><span /><span /></span>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </main>

      <footer className={styles.footer}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            autoFocus
          />
          {isLoading ? (
            <button
              type="button"
              className={styles.stopBtn}
              onClick={stop}
              aria-label="Stop"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </form>
        <p className={styles.footerNote}>Mastra · {title} · AI SDK UI</p>
      </footer>
    </div>
  )
}
