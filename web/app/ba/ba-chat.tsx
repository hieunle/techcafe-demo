'use client'

import { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react'
import styles from './ba-chat.module.css'
import { MarkdownMessage } from '../components/markdown-message'

/* ── Types ── */
type BAPhase = 'discovery' | 'research' | 'refinement' | 'validation' | 'complete'

interface BAQuestion {
  id: string
  question: string
  options: string[]
  allowCustom: boolean
  /** When false/omitted in JSON, UI is single-select. */
  multiSelect: boolean
}

interface BASentinel {
  phase: BAPhase
  questions: BAQuestion[]
  brief?: string
}

interface ContentPart {
  type: 'text' | 'image'
  text?: string
  image?: string
  mimeType?: string
}

interface ToolCallPart {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  status: 'calling' | 'done'
  result?: {
    answer?: string
    sources?: { url: string; title: string }[]
    searchCount?: number
  }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  /** Sent to the API. For user msgs: string or ContentPart[]. For assistant: clean display text. */
  content: string | ContentPart[]
  /** What's shown in the chat bubble */
  displayText: string
  imagePreview?: string
  toolCalls?: ToolCallPart[]
  phase?: BAPhase
  questions?: BAQuestion[]
  brief?: string
}

type Status = 'idle' | 'streaming' | 'error'

const PHASE_LABELS: Record<BAPhase, string> = {
  discovery: 'Discovery',
  research: 'Research',
  refinement: 'Refinement',
  validation: 'Validation',
  complete: 'Complete',
}

const PHASE_ORDER: BAPhase[] = ['discovery', 'research', 'refinement', 'validation', 'complete']

const SENTINEL_RE = /<!--BA:([\s\S]*?)-->/

/* ── Sentinel helpers ── */
function stripLiveSentinel(text: string): string {
  // Once we see the opening tag, hide everything from there onward while streaming
  const start = text.indexOf('<!--BA:')
  return start === -1 ? text : text.slice(0, start)
}

function parseSentinel(rawText: string): { displayText: string } & Partial<BASentinel> {
  const match = rawText.match(SENTINEL_RE)
  if (!match) return { displayText: rawText.trimEnd() }

  let sentinel: Partial<BASentinel> = {}
  try {
    sentinel = JSON.parse(match[1]) as BASentinel
  } catch {
    /* malformed — keep defaults */
  }

  const displayText = rawText.replace(SENTINEL_RE, '').trimEnd()
  const rawQs = sentinel.questions
  const questions: BAQuestion[] = Array.isArray(rawQs)
    ? rawQs.map((q: Partial<BAQuestion>) => ({
        id: String(q.id ?? ''),
        question: String(q.question ?? ''),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        allowCustom: q.allowCustom !== false,
        multiSelect: q.multiSelect === true,
      }))
    : []
  return {
    displayText,
    phase: sentinel.phase,
    questions,
    brief: sentinel.brief,
  }
}

/* ── Hook ── */
function useBAStreamChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<BAPhase>('discovery')
  const abortRef = useRef<AbortController | null>(null)
  const rawTextRef = useRef('')

  const send = useCallback(
    async (content: string | ContentPart[], displayText: string) => {
      setError(null)
      setStatus('streaming')
      rawTextRef.current = ''

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        displayText,
        imagePreview: Array.isArray(content)
          ? (content.find((p) => p.type === 'image') as ContentPart | undefined)?.image
          : undefined,
      }

      const assistantId = crypto.randomUUID()
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        displayText: '',
        toolCalls: [],
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      // Build history — use displayText for assistant messages (clean, no sentinel)
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      try {
        const res = await fetch('/api/ba', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Server error ${res.status}` }))
          throw new Error(err.error ?? `Server error ${res.status}`)
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buf = ''
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

            if (type === 'text-delta') {
              const { text: chunk } = payload as { text: string }
              rawTextRef.current += chunk
              const liveDisplay = stripLiveSentinel(rawTextRef.current)

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, displayText: liveDisplay } : m,
                ),
              )
            } else if (type === 'tool-call-input-streaming-start') {
              const { toolCallId, toolName } = payload as { toolCallId: string; toolName: string }
              argsMap[toolCallId] = ''
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: [
                          ...(m.toolCalls ?? []),
                          { toolCallId, toolName, args: {}, status: 'calling' },
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
              if (toolCallId in argsMap) argsMap[toolCallId] += argsTextDelta
            } else if (type === 'tool-call') {
              const { toolCallId, args } = payload as {
                toolCallId: string
                args: Record<string, unknown>
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: (m.toolCalls ?? []).map((tc) =>
                          tc.toolCallId === toolCallId ? { ...tc, args } : tc,
                        ),
                      }
                    : m,
                ),
              )
            } else if (type === 'tool-result') {
              const { toolCallId, result } = payload as {
                toolCallId: string
                result: ToolCallPart['result']
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: (m.toolCalls ?? []).map((tc) =>
                          tc.toolCallId === toolCallId
                            ? { ...tc, status: 'done', result: result ?? undefined }
                            : tc,
                        ),
                      }
                    : m,
                ),
              )
            }
          }
        }

        // Stream complete — parse sentinel from full raw text
        const { displayText: finalDisplay, phase, questions, brief } = parseSentinel(rawTextRef.current)

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            return {
              ...m,
              content: finalDisplay,
              displayText: finalDisplay,
              phase,
              questions: questions ?? [],
              brief,
            }
          }),
        )

        if (phase) setCurrentPhase(phase)
        setStatus('idle')
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setStatus('idle')
          return
        }
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        setStatus('error')
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      }
    },
    [messages],
  )

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const activeQuestions = lastAssistant?.questions ?? []

  return { messages, status, error, currentPhase, activeQuestions, send }
}

/* ── Phase bar ── */
function PhaseBar({ current }: { current: BAPhase }) {
  const idx = PHASE_ORDER.indexOf(current)
  return (
    <div className={styles.phaseBar}>
      {PHASE_ORDER.map((phase, i) => (
        <div
          key={phase}
          className={`${styles.phaseStep} ${i <= idx ? styles.phaseStepActive : ''} ${i === idx ? styles.phaseStepCurrent : ''}`}
        >
          <span className={styles.phaseStepDot} />
          <span className={styles.phaseStepLabel}>{PHASE_LABELS[phase]}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Web search tool card ── */
function WebSearchCard({ tc }: { tc: ToolCallPart }) {
  const [expanded, setExpanded] = useState(false)
  const query = (tc.args?.query as string) ?? ''
  const done  = tc.status === 'done'
  const result = tc.result

  return (
    <div className={`${styles.searchCard} ${done ? styles.searchCardDone : ''}`}>
      <button
        type="button"
        className={styles.searchHeader}
        onClick={() => done && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.searchIcon}>
          {done ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <span className={styles.searchSpinner} />
          )}
        </span>
        <span className={styles.searchLabel}>
          {done ? 'Web search complete' : 'Searching the web…'}
        </span>
        {query && <span className={styles.searchQueryInline}>&ldquo;{query}&rdquo;</span>}
        {done && result?.sources && (
          <span className={styles.searchBadge}>{result.sources.length} sources</span>
        )}
        {done && (
          <span className={styles.searchExpand}>{expanded ? '▲' : '▼'}</span>
        )}
      </button>

      {expanded && done && result && (
        <div className={styles.searchBody}>
          {result.answer && (
            <div className={styles.searchSection}>
              <span className={styles.searchSectionLabel}>Summary</span>
              <p className={styles.searchAnswerText}>
                {result.answer.slice(0, 400)}{result.answer.length > 400 ? '…' : ''}
              </p>
            </div>
          )}
          {(result.sources ?? []).length > 0 && (
            <div className={styles.searchSection}>
              <span className={styles.searchSectionLabel}>Sources</span>
              <div className={styles.searchSources}>
                {result.sources!.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className={styles.searchSourceLink}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    {s.title || s.url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Questions panel ── */
function QuestionsPanel({
  questions,
  onSubmit,
  disabled,
}: {
  questions: BAQuestion[]
  onSubmit: (answers: Record<string, string | string[]>) => void
  disabled: boolean
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [customs, setCustoms] = useState<Record<string, string>>({})

  useEffect(() => {
    setAnswers({})
    setCustoms({})
  }, [questions])

  const toggle = (qId: string, option: string, multiSelect: boolean) => {
    if (multiSelect) {
      setAnswers((prev) => {
        const current = (prev[qId] as string[]) ?? []
        return {
          ...prev,
          [qId]: current.includes(option)
            ? current.filter((o) => o !== option)
            : [...current, option],
        }
      })
    } else {
      setAnswers((prev) => ({ ...prev, [qId]: option }))
    }
  }

  const isSelected = (qId: string, option: string) => {
    const val = answers[qId]
    return Array.isArray(val) ? val.includes(option) : val === option
  }

  const isAnswered = (q: BAQuestion) => {
    const val = answers[q.id]
    const custom = customs[q.id]?.trim()
    if (Array.isArray(val) && val.length > 0) return true
    if (typeof val === 'string' && val) return true
    if (custom) return true
    return false
  }

  const allAnswered = questions.every(isAnswered)

  const handleSubmit = () => {
    const merged: Record<string, string | string[]> = {}
    for (const q of questions) {
      const val = answers[q.id]
      const custom = customs[q.id]?.trim()
      if (Array.isArray(val) && val.length > 0) {
        merged[q.id] = custom ? [...val, custom] : val
      } else if (typeof val === 'string' && val) {
        merged[q.id] = val
      } else if (custom) {
        merged[q.id] = custom
      }
    }
    onSubmit(merged)
  }

  if (questions.length === 0) return null

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        Help me understand your vision
      </div>
      <div className={styles.panelQuestions}>
        {questions.map((q) => (
          <div key={q.id} className={styles.question}>
            <div className={styles.questionHeader}>
              <p className={styles.questionText}>{q.question}</p>
              <span
                className={q.multiSelect ? styles.selectBadgeMulti : styles.selectBadgeSingle}
                title={
                  q.multiSelect
                    ? 'You can select several options, or combine with your own text below.'
                    : 'Choose one option, or use your own answer below.'
                }
              >
                {q.multiSelect ? 'Multiple choice' : 'Single choice'}
              </span>
            </div>
            <p className={styles.selectHint}>
              {q.multiSelect
                ? 'Select all options that apply.'
                : 'Select one option only.'}
            </p>
            <div
              className={styles.options}
              role="group"
              aria-label={
                q.multiSelect
                  ? `${q.question} (multiple choice)`
                  : `${q.question} (single choice)`
              }
            >
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.chip} ${isSelected(q.id, opt) ? styles.chipSelected : ''}`}
                  onClick={() => toggle(q.id, opt, q.multiSelect)}
                  disabled={disabled}
                >
                  {q.multiSelect && isSelected(q.id, opt) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {opt}
                </button>
              ))}
            </div>
            {q.allowCustom && (
              <input
                className={styles.customInput}
                placeholder="Or type your own answer…"
                value={customs[q.id] ?? ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setCustoms((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                disabled={disabled}
              />
            )}
          </div>
        ))}
      </div>
      <div className={styles.panelFooter}>
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={disabled || !allAnswered}
        >
          Send answers
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Brief card ── */
function BriefCard({ brief }: { brief: string }) {
  return (
    <div className={styles.briefCard}>
      <div className={styles.briefHeader}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Product Brief
      </div>
      <pre className={styles.briefContent}>{brief}</pre>
    </div>
  )
}

/* ── Main chat ── */
export default function BAChat() {
  const { messages, status, error, currentPhase, activeQuestions, send } = useBAStreamChat()
  const [input, setInput] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isStreaming = status === 'streaming'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeQuestions])

  const handleAnswers = useCallback(
    (answers: Record<string, string | string[]>) => {
      const lines = Object.entries(answers).map(([, val]) =>
        Array.isArray(val) ? val.join(', ') : val,
      )
      const text = lines.join('\n')
      send(text, text)
    },
    [send],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if ((!text && !imageData) || isStreaming) return

    if (imageData) {
      const parts: ContentPart[] = []
      if (text) parts.push({ type: 'text', text })
      // Extract mimeType from data URL (e.g. "data:image/png;base64,...")
      const mimeType = imageData.match(/^data:([^;]+);/)?.[1] ?? 'image/jpeg'
      parts.push({ type: 'image', image: imageData, mimeType })
      send(parts, text || '📎 Image attached')
    } else {
      send(text, text)
    }

    setInput('')
    setImageData(null)
    setImageName(null)
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageData(reader.result as string)
      setImageName(file.name)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className={styles.shell}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.avatar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>BA Brainstorm</h1>
            <p className={styles.subtitle}>BMAD · claude-haiku-4-5 via OpenRouter · web search</p>
          </div>
        </div>
        <PhaseBar current={currentPhase} />
      </header>

      {/* Body: chat column + right questions panel */}
      <div className={styles.body}>
        {/* ── Left: chat column ── */}
        <div className={styles.chatArea}>
          {/* Messages */}
          <main className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className={styles.emptyTitle}>What&rsquo;s your product idea?</p>
            <p className={styles.emptyHint}>Describe it in a sentence — I&apos;ll guide you through the rest.</p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.row} ${m.role === 'user' ? styles.userRow : styles.assistantRow}`}
          >
            {m.role === 'assistant' && (
              <div className={styles.msgAvatar}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
            )}
            <div className={styles.bubbleCol}>
              {/* Tool call cards (web search) */}
              {m.role === 'assistant' && (m.toolCalls ?? []).map((tc) => (
                <WebSearchCard key={tc.toolCallId} tc={tc} />
              ))}

              {/* Image preview (user) */}
              {m.imagePreview && (
                <img src={m.imagePreview} alt="Attached" className={styles.imagePreview} />
              )}

              {/* Text bubble */}
              {(m.displayText || m.role === 'assistant') && (
                <div className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                  {m.displayText ? (
                    m.role === 'assistant' ? (
                      <MarkdownMessage content={m.displayText} accentColor="var(--ba-accent)" />
                    ) : (
                      m.displayText
                    )
                  ) : (
                    m.role === 'assistant' && (m.toolCalls ?? []).length === 0
                      ? <span className={styles.typing}><span /><span /><span /></span>
                      : null
                  )}
                </div>
              )}

              {/* Product brief */}
              {m.brief && <BriefCard brief={m.brief} />}
            </div>
          </div>
        ))}

        {error && (
          <div className={styles.errorBanner}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
        </main>

        {/* Input footer */}
        <footer className={styles.footer}>
        {imageData && (
          <div className={styles.imageAttachment}>
            <img src={imageData} alt="preview" className={styles.attachThumb} />
            <span className={styles.attachName}>{imageName}</span>
            <button
              className={styles.attachRemove}
              onClick={() => { setImageData(null); setImageName(null) }}
              type="button"
            >
              ×
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className={styles.form}>
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => fileRef.current?.click()}
            disabled={isStreaming}
            title="Attach image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className={styles.fileInput} />
          <input
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              activeQuestions.length > 0
                ? 'Or type a free-form response…'
                : 'Describe your idea or ask anything…'
            }
            disabled={isStreaming}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={isStreaming || (!input.trim() && !imageData)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        <p className={styles.footerNote}>BA Brainstorm · BMAD method · Powered by claude-haiku-4-5 via OpenRouter</p>
        </footer>
        </div>{/* end chatArea */}

        {/* ── Right: questions panel ── */}
        <aside className={styles.sidePanel}>
          {activeQuestions.length > 0 ? (
            <QuestionsPanel
              questions={activeQuestions}
              onSubmit={handleAnswers}
              disabled={isStreaming}
            />
          ) : (
            <div className={styles.sidePanelEmpty}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              <p className={styles.sidePanelEmptyTitle}>Questions panel</p>
              <p className={styles.sidePanelEmptyHint}>
                As we work through each phase, I&apos;ll ask you questions here to refine your idea.
              </p>
            </div>
          )}
        </aside>

      </div>{/* end body */}
    </div>
  )
}
