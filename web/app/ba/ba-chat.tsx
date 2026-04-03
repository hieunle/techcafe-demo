'use client'

import { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react'
import styles from './ba-chat.module.css'

/* ── Types ── */
type BAPhase = 'discovery' | 'research' | 'refinement' | 'validation' | 'complete'

interface BAQuestion {
  id: string
  question: string
  options: string[]
  allowCustom: boolean
  multiSelect: boolean
}

interface BAResponse {
  message: string
  phase: BAPhase
  questions: BAQuestion[]
  brief?: string
}

type MessageRole = 'user' | 'assistant' | 'system'

interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

interface Message {
  id: string
  role: MessageRole
  content: string | ContentPart[]
  displayText?: string
  phase?: BAPhase
  questions?: BAQuestion[]
  brief?: string
  imagePreview?: string
}

type Status = 'idle' | 'loading' | 'error'

const PHASE_LABELS: Record<BAPhase, string> = {
  discovery: 'Discovery',
  research: 'Research',
  refinement: 'Refinement',
  validation: 'Validation',
  complete: 'Complete',
}

const PHASE_ORDER: BAPhase[] = ['discovery', 'research', 'refinement', 'validation', 'complete']

/* ── Hook ── */
function useBAChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<BAPhase>('discovery')

  const send = useCallback(
    async (content: string | ContentPart[], displayText: string) => {
      setError(null)
      setStatus('loading')

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        displayText,
        imagePreview:
          Array.isArray(content)
            ? (content.find((p) => p.type === 'image_url') as ContentPart | undefined)?.image_url?.url
            : undefined,
      }

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      setMessages((prev) => [...prev, userMsg])

      try {
        const res = await fetch('/api/ba', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(err.error ?? `Server error ${res.status}`)
        }

        const data: BAResponse = await res.json()

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          displayText: data.message,
          phase: data.phase,
          questions: data.questions,
          brief: data.brief,
        }

        setMessages((prev) => [...prev, assistantMsg])
        setCurrentPhase(data.phase)
        setStatus('idle')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        setStatus('idle')
      }
    },
    [messages],
  )

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const activeQuestions = lastAssistant?.questions ?? []

  return { messages, status, error, currentPhase, activeQuestions, send }
}

/* ── Phase progress bar ── */
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
        </svg>
        Help me understand your vision
      </div>
      <div className={styles.panelQuestions}>
        {questions.map((q) => (
          <div key={q.id} className={styles.question}>
            <p className={styles.questionText}>{q.question}</p>
            <div className={styles.options}>
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.chip} ${isSelected(q.id, opt) ? styles.chipSelected : ''}`}
                  onClick={() => toggle(q.id, opt, q.multiSelect)}
                  disabled={disabled}
                >
                  {q.multiSelect && isSelected(q.id, opt) && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  const { messages, status, error, currentPhase, activeQuestions, send } = useBAChat()
  const [input, setInput] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isLoading = status === 'loading'

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
    if ((!text && !imageData) || isLoading) return

    if (imageData) {
      const parts: ContentPart[] = []
      if (text) parts.push({ type: 'text', text })
      parts.push({ type: 'image_url', image_url: { url: imageData } })
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
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>BA Brainstorm</h1>
            <p className={styles.subtitle}>BMAD · claude-haiku-4-5 · web search</p>
          </div>
        </div>
        <PhaseBar current={currentPhase} />
      </header>

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
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
            )}
            <div className={styles.bubbleCol}>
              {m.imagePreview && (
                <img src={m.imagePreview} alt="Attached" className={styles.imagePreview} />
              )}
              <div className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                {m.displayText || (typeof m.content === 'string' ? m.content : '…')}
              </div>
              {m.brief && <BriefCard brief={m.brief} />}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className={`${styles.row} ${styles.assistantRow}`}>
            <div className={styles.msgAvatar}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className={`${styles.bubble} ${styles.assistantBubble}`}>
              <span className={styles.typing}><span /><span /><span /></span>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Questions panel */}
      <QuestionsPanel
        questions={activeQuestions}
        onSubmit={handleAnswers}
        disabled={isLoading}
      />

      {/* Input */}
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
            disabled={isLoading}
            title="Attach image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
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
            disabled={isLoading}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={isLoading || (!input.trim() && !imageData)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        <p className={styles.footerNote}>BA Brainstorm · BMAD method · Powered by Anthropic claude-haiku-4-5</p>
      </footer>
    </div>
  )
}
