'use client'

import { useState, useCallback, useRef, useEffect, useMemo, ChangeEvent } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import styles from './ba-chat.module.css'
import { MarkdownMessage } from '../components/markdown-message'
import HistorySidebar from './history-sidebar'

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

/* ── Tool part helpers ── */
interface ToolPartLike {
  type: string
  toolCallId: string
  toolName?: string
  state: string
  input: Record<string, unknown>
  output?: unknown
}

function isToolCallPart(part: { type: string }): boolean {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool'
}

function getPartToolName(part: ToolPartLike): string {
  if (part.type === 'dynamic-tool') return part.toolName ?? 'unknown'
  return part.type.replace(/^tool-/, '')
}

/* ── Processed message type ── */
interface ProcessedMessage {
  msg: UIMessage
  displayText: string
  brief?: string
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

/* ── Tool call config by tool name ── */
const TOOL_CALL_CONFIG: Record<string, { labelDoing: string; labelDone: string; icon: React.ReactNode }> = {
  webSearch: {
    labelDoing: 'Searching the web\u2026',
    labelDone: 'Web search complete',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  webSearchTool: {
    labelDoing: 'Searching the web\u2026',
    labelDone: 'Web search complete',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  'ba-research-agent': {
    labelDoing: 'Research agent working\u2026',
    labelDone: 'Research complete',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  baResearchAgent: {
    labelDoing: 'Research agent working\u2026',
    labelDone: 'Research complete',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
}

function getToolConfig(toolName: string) {
  return TOOL_CALL_CONFIG[toolName] ?? {
    labelDoing: `Running ${toolName}\u2026`,
    labelDone: `${toolName} complete`,
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
      </svg>
    ),
  }
}

/* ── Tool call card (works with AI SDK tool parts) ── */
function ToolCallCard({ part }: { part: ToolPartLike }) {
  const [expanded, setExpanded] = useState(false)
  const toolName = getPartToolName(part)
  const done = part.state === 'output-available'
  const config = getToolConfig(toolName)

  const resultObj: { answer?: string; sources?: { url: string; title: string }[]; searchCount?: number; text?: string } | null =
    part.output == null
      ? null
      : typeof part.output === 'string'
      ? { text: part.output }
      : (part.output as { answer?: string; sources?: { url: string; title: string }[]; searchCount?: number; text?: string })

  const query = (part.input?.query as string) ?? (part.input?.prompt as string) ?? (part.input?.message as string) ?? ''
  const answer = resultObj?.answer ?? resultObj?.text ?? ''
  const sources = resultObj?.sources ?? []

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
          {done ? config.labelDone : config.labelDoing}
        </span>
        {query && <span className={styles.searchQueryInline}>&ldquo;{query}&rdquo;</span>}
        {done && sources.length > 0 && (
          <span className={styles.searchBadge}>{sources.length} sources</span>
        )}
        {done && (
          <span className={styles.searchExpand}>{expanded ? '▲' : '▼'}</span>
        )}
      </button>

      {expanded && done && resultObj && (
        <div className={styles.searchBody}>
          {answer && (
            <div className={styles.searchSection}>
              <span className={styles.searchSectionLabel}>Summary</span>
              <p className={styles.searchAnswerText}>
                {answer.slice(0, 400)}{answer.length > 400 ? '…' : ''}
              </p>
            </div>
          )}
          {sources.length > 0 && (
            <div className={styles.searchSection}>
              <span className={styles.searchSectionLabel}>Sources</span>
              <div className={styles.searchSources}>
                {sources.map((s, i) => (
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

/* ── Mastra message → UIMessage converter ── */
interface MastraMsgPart {
  type: string
  // text parts
  text?: string
  // image parts — Mastra/AI SDK CoreMessage stores images in several ways
  image?: string          // base64 bytes string or data URL or https URL
  url?: string            // pre-formed data URL
  // file parts
  data?: string           // base64 data
  // mime/media type — field name varies across SDK versions
  mediaType?: string
  mimeType?: string
}

interface MastraMsg {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: { parts?: MastraMsgPart[]; content?: string }
  createdAt: string
}

function toDataUrl(raw: string, mediaType: string): string {
  if (raw.startsWith('data:') || raw.startsWith('http')) return raw
  return `data:${mediaType};base64,${raw}`
}

function mastraToUIMessages(msgs: MastraMsg[]): UIMessage[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const uiParts: UIMessage['parts'] = []

      if (m.content?.parts?.length) {
        for (const p of m.content.parts) {
          if (p.type === 'text') {
            uiParts.push({ type: 'text', text: p.text ?? '' })
          } else if (p.type === 'image') {
            // CoreMessage image part: { type: 'image', image: '<base64 | URL>', mimeType/mediaType }
            const mediaType = p.mediaType ?? p.mimeType ?? 'image/jpeg'
            const raw = p.url ?? p.image ?? ''
            if (raw) {
              uiParts.push({
                type: 'file',
                url: toDataUrl(raw, mediaType),
                mediaType,
              } as { type: 'file'; url: string; mediaType: string })
            }
          } else if (p.type === 'file') {
            const mediaType = p.mediaType ?? p.mimeType ?? 'application/octet-stream'
            const raw = p.url ?? p.data ?? p.image ?? ''
            if (raw) {
              uiParts.push({
                type: 'file',
                url: toDataUrl(raw, mediaType),
                mediaType,
              } as { type: 'file'; url: string; mediaType: string })
            }
          }
        }
      }

      // Fallback: if nothing extracted, use top-level content string
      if (uiParts.length === 0) {
        uiParts.push({ type: 'text', text: m.content?.content ?? '' })
      }

      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: uiParts,
        createdAt: new Date(m.createdAt),
      }
    })
}

/* ── Inner chat (receives threadId from wrapper) ── */
function BAChatInner({ threadId, loadExisting, onFirstMessage }: {
  threadId: string
  loadExisting: boolean
  onFirstMessage: () => void
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/agents/ba-agent',
        body: { memory: { thread: threadId, resource: 'ba-agent' } },
      }),
    [threadId],
  )
  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: threadId,
    transport,
  })

  const [input, setInput] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(loadExisting)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isStreaming = status === 'submitted' || status === 'streaming'
  const hasSentFirst = useRef(false)

  useEffect(() => {
    if (loadExisting) {
      // Load history for existing thread
      let cancelled = false
      fetch(`/api/threads/${threadId}/messages`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          setMessages(mastraToUIMessages(data.messages ?? []))
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoadingHistory(false) })
      return () => { cancelled = true }
    } else {
      // Pre-create the thread so it appears in the sidebar immediately
      fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, resourceId: 'ba-agent' }),
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  /* ── Derive phase, questions, and display text from raw messages ── */
  const { processed, currentPhase, activeQuestions } = useMemo(() => {
    let phase: BAPhase = 'discovery'
    let lastQuestions: BAQuestion[] = []
    const isActive = status === 'streaming' || status === 'submitted'

    const result: ProcessedMessage[] = messages.map((msg, i) => {
      if (msg.role !== 'assistant') {
        const userText = msg.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('')
        return { msg, displayText: userText }
      }

      const rawText = msg.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('')

      const isLastMsg = i === messages.length - 1
      const isCurrentlyStreaming = isLastMsg && isActive

      if (isCurrentlyStreaming) {
        return { msg, displayText: stripLiveSentinel(rawText) }
      }

      const { displayText, phase: msgPhase, questions: msgQuestions, brief: msgBrief } = parseSentinel(rawText)

      if (msgPhase) phase = msgPhase
      lastQuestions = msgQuestions ?? []

      return { msg, displayText, brief: msgBrief }
    })

    return {
      processed: result,
      currentPhase: phase,
      activeQuestions: isActive ? [] : lastQuestions,
    }
  }, [messages, status])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeQuestions])

  const notifyFirstMessage = useCallback(() => {
    if (!hasSentFirst.current) {
      hasSentFirst.current = true
      // Refresh sidebar after title generation completes (LLM call takes a few seconds)
      setTimeout(() => onFirstMessage(), 6000)
    }
  }, [onFirstMessage])

  const handleAnswers = useCallback(
    (answers: Record<string, string | string[]>) => {
      const lines = Object.entries(answers).map(([, val]) =>
        Array.isArray(val) ? val.join(', ') : val,
      )
      const text = lines.join('\n')
      sendMessage({ text })
      notifyFirstMessage()
    },
    [sendMessage, notifyFirstMessage],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if ((!text && !imageData) || isStreaming) return

    if (imageData) {
      const mimeType = imageData.match(/^data:([^;]+);/)?.[1] ?? 'image/jpeg'
      sendMessage({
        text: text || '📎 Image attached',
        files: [{ type: 'file', mediaType: mimeType, url: imageData }],
      })
    } else {
      sendMessage({ text })
    }

    notifyFirstMessage()
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
            <p className={styles.subtitle}>BMAD · claude-haiku-4-5 via OpenRouter · research agent</p>
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
        {messages.length === 0 && !loadingHistory && (
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

        {processed.map(({ msg, displayText, brief }) => (
          <div
            key={msg.id}
            className={`${styles.row} ${msg.role === 'user' ? styles.userRow : styles.assistantRow}`}
          >
            {msg.role === 'assistant' && (
              <div className={styles.msgAvatar}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
            )}
            <div className={styles.bubbleCol}>
              {/* Tool call cards (assistant only) */}
              {msg.role === 'assistant' && msg.parts.filter(isToolCallPart).map((part, i) => (
                <ToolCallCard key={(part as ToolPartLike).toolCallId ?? i} part={part as ToolPartLike} />
              ))}

              {/* Image preview (user messages with file parts) */}
              {msg.role === 'user' && msg.parts
                .filter((p): p is { type: 'file'; mediaType: string; url: string } =>
                  p.type === 'file' && (p as { mediaType?: string }).mediaType?.startsWith('image/') === true
                )
                .map((fp, i) => (
                  <img key={i} src={fp.url} alt="Attached" className={styles.imagePreview} />
                ))
              }

              {/* Text bubble */}
              {(displayText || msg.role === 'assistant') && (
                <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                  {displayText ? (
                    msg.role === 'assistant' ? (
                      <MarkdownMessage content={displayText} accentColor="var(--ba-accent)" />
                    ) : (
                      displayText
                    )
                  ) : (
                    msg.role === 'assistant' && msg.parts.filter(isToolCallPart).length === 0
                      ? <span className={styles.typing}><span /><span /><span /></span>
                      : null
                  )}
                </div>
              )}

              {/* Product brief */}
              {brief && <BriefCard brief={brief} />}
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
            {error.message}
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

/* ── Outer wrapper: manages thread state + renders sidebar + inner chat ── */
export default function BAChat() {
  const [threadId, setThreadId] = useState(() => crypto.randomUUID())
  const [isExisting, setIsExisting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleNewChat = useCallback(() => {
    setThreadId(crypto.randomUUID())
    setIsExisting(false)
  }, [])

  const handleSelectThread = useCallback((id: string) => {
    setThreadId(id)
    setIsExisting(true)
  }, [])

  const handleFirstMessage = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className={styles.outerShell}>
      <HistorySidebar
        activeThreadId={threadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        refreshKey={refreshKey}
      />
      <div className={styles.chatMain}>
        <BAChatInner
          key={threadId}
          threadId={threadId}
          loadExisting={isExisting}
          onFirstMessage={handleFirstMessage}
        />
      </div>
    </div>
  )
}
