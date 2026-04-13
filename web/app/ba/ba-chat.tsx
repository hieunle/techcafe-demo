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

interface BADataPart {
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

/* ── Tool part helpers ── */

/**
 * Normalized tool invocation – works with both message formats:
 *   v5 (from mastraToUIMessages on reload): { type:'tool-invocation', toolInvocation:{...} }
 *   v6 (from useChat live stream):          { type:'dynamic-tool', toolName, state, input, output }
 *                                           { type:'tool-{name}', state, input, output }
 */
interface NormalizedToolInvocation {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  isDone: boolean
  result?: unknown
}

function getToolInvocationFromPart(part: Record<string, unknown>): NormalizedToolInvocation | null {
  const type = part.type as string

  // v5 format – stored messages loaded on reload via mastraToUIMessages
  if (type === 'tool-invocation' && part.toolInvocation) {
    const inv = part.toolInvocation as { toolCallId: string; toolName: string; args: Record<string, unknown>; state: string; result?: unknown }
    return { toolCallId: inv.toolCallId, toolName: inv.toolName, args: inv.args ?? {}, isDone: inv.state === 'result', result: inv.result }
  }

  // v6 dynamic-tool format – live stream from useChat v6
  if (type === 'dynamic-tool') {
    return {
      toolCallId: (part.toolCallId as string) ?? '',
      toolName: (part.toolName as string) ?? '',
      args: (part.input as Record<string, unknown>) ?? {},
      isDone: part.state === 'output-available',
      result: part.output,
    }
  }

  // v6 static tool format – type is 'tool-{name}', e.g. 'tool-webSearch'
  if (type.startsWith('tool-') && type !== 'tool-invocation') {
    return {
      toolCallId: (part.toolCallId as string) ?? '',
      toolName: type.slice('tool-'.length),
      args: (part.input as Record<string, unknown>) ?? {},
      isDone: part.state === 'output-available',
      result: part.output,
    }
  }

  return null
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
  askQuestions: {
    labelDoing: 'Preparing questions\u2026',
    labelDone: 'Questions ready',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
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

/* ── Tool call card (works with both AI SDK v5 reload and v6 live-stream parts) ── */
function ToolCallCard({ inv }: { inv: NormalizedToolInvocation }) {
  const [expanded, setExpanded] = useState(false)
  const { isDone } = inv
  const config = getToolConfig(inv.toolName)

  const args = inv.args ?? {}
  const query = (args.query as string) ?? (args.prompt as string) ?? (args.message as string) ?? ''

  const hasArgs = Object.keys(args).length > 0
  const hasResult = inv.result != null

  return (
    <div className={`${styles.searchCard} ${isDone ? styles.searchCardDone : ''}`}>
      <button
        type="button"
        className={styles.searchHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.searchIcon}>
          {isDone ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <span className={styles.searchSpinner} />
          )}
        </span>
        <span className={styles.searchLabel}>
          {isDone ? config.labelDone : config.labelDoing}
        </span>
        {query && <span className={styles.searchQueryInline}>&ldquo;{query}&rdquo;</span>}
        <span className={styles.searchExpand}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className={styles.searchBody}>
          {hasArgs && (
            <div className={styles.searchSection}>
              <span className={styles.searchSectionLabel}>Arguments</span>
              <pre className={styles.toolJson}>{JSON.stringify(args, null, 2)}</pre>
            </div>
          )}
          {hasResult && (
            <div className={styles.searchSection}>
              <span className={styles.searchSectionLabel}>Result</span>
              <pre className={styles.toolJson}>
                {typeof inv.result === 'string'
                  ? inv.result
                  : JSON.stringify(inv.result, null, 2)}
              </pre>
            </div>
          )}
          {!hasArgs && !hasResult && (
            <div className={styles.searchSection}>
              <span className={styles.searchSectionLabel}>
                {isDone ? 'No data' : 'Waiting for result…'}
              </span>
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

/* ── Answered questions card (read-only, Cursor-style) ── */
function AnsweredQuestionsCard({
  questions,
  answers,
}: {
  questions: BAQuestion[]
  answers: Record<string, string | string[]>
}) {
  if (questions.length === 0) return null

  return (
    <div className={styles.answeredCard}>
      <div className={styles.answeredHeader}>
        <span className={styles.answeredHeaderIcon}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        Questions answered
      </div>
      {questions.map((q) => {
        const val = answers[q.id]
        const selected = Array.isArray(val) ? val : val ? [val] : []
        return (
          <div key={q.id} className={styles.answeredQuestion}>
            <p className={styles.answeredQuestionText}>{q.question}</p>
            <div className={styles.answeredLabel}>Answer</div>
            <div className={styles.answeredChips}>
              {selected.map((s) => (
                <span key={s} className={styles.answeredChip}>
                  <span className={styles.answeredChipCheck}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )
      })}
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MastraMsgPart = Record<string, any>

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
          } else if (p.type === 'tool-invocation' && p.toolInvocation) {
            uiParts.push({
              type: 'tool-invocation',
              toolInvocation: p.toolInvocation,
            } as unknown as UIMessage['parts'][number])
          } else if (p.type === 'data-ba-questions' && p.data) {
            uiParts.push({
              type: 'data-ba-questions',
              data: p.data,
            } as unknown as UIMessage['parts'][number])
          } else if (p.type === 'image') {
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

/* ── Extract BA data from a message's parts ── */
function extractBADataFromParts(parts: UIMessage['parts']): Partial<BADataPart> | null {
  for (const part of parts) {
    if (part.type === 'data-ba-questions') {
      const data = (part as { type: string; data: BADataPart }).data
      if (data && data.phase) return data
    }
  }
  return null
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
  const { messages, sendMessage, setMessages, stop, status, error } = useChat({
    id: threadId,
    transport,
  })

  const [input, setInput] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(loadExisting)
  const [answeredMap, setAnsweredMap] = useState<
    Record<string, { questions: BAQuestion[]; answers: Record<string, string | string[]> }>
  >({})
  const [answerMsgIds, setAnswerMsgIds] = useState<Set<string>>(new Set())
  const pendingAnswer = useRef(false)
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

  /* ── Derive phase, active questions, and reconstruct answered state from history ── */
  const { currentPhase, lastQuestionsMessageId, hasActiveQuestions, restoredAnswered, restoredAnswerMsgIds } = useMemo(() => {
    let phase: BAPhase = 'discovery'
    let lastMsgId: string | undefined
    let lastQuestions: BAQuestion[] = []
    const isActive = status === 'streaming' || status === 'submitted'
    const restored: Record<string, { questions: BAQuestion[]; answers: Record<string, string | string[]> }> = {}
    const answerUserMsgIds = new Set<string>()

    for (const msg of messages) {
      if (msg.role === 'user' && lastMsgId) {
        const userText = msg.parts.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined
        if (userText?.text && lastQuestions.length > 0) {
          const answers: Record<string, string | string[]> = {}
          const lines = userText.text.split('\n')
          for (const line of lines) {
            const sepIdx = line.indexOf(': ')
            if (sepIdx === -1) continue
            const questionText = line.slice(0, sepIdx)
            const answerText = line.slice(sepIdx + 2)
            const matched = lastQuestions.find((q) => q.question === questionText)
            if (matched) {
              const vals = answerText.split(', ')
              answers[matched.id] = vals.length > 1 ? vals : answerText
            }
          }
          if (Object.keys(answers).length > 0) {
            restored[lastMsgId] = { questions: lastQuestions, answers }
            answerUserMsgIds.add(msg.id)
          }
        }
        lastMsgId = undefined
        lastQuestions = []
        continue
      }
      if (msg.role !== 'assistant') continue
      const baData = extractBADataFromParts(msg.parts)
      if (!baData) continue
      if (baData.phase) phase = baData.phase
      if ((baData.questions ?? []).length > 0) {
        lastMsgId = msg.id
        lastQuestions = baData.questions as BAQuestion[]
      }
    }

    return {
      currentPhase: phase,
      lastQuestionsMessageId: isActive ? undefined : lastMsgId,
      hasActiveQuestions: !isActive && lastMsgId !== undefined,
      restoredAnswered: restored,
      restoredAnswerMsgIds: answerUserMsgIds,
    }
  }, [messages, status])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const notifyFirstMessage = useCallback(() => {
    if (!hasSentFirst.current) {
      hasSentFirst.current = true
      // Refresh sidebar after title generation completes (LLM call takes a few seconds)
      setTimeout(() => onFirstMessage(), 6000)
    }
  }, [onFirstMessage])

  useEffect(() => {
    if (pendingAnswer.current && messages.length > 0) {
      const last = messages[messages.length - 1]
      if (last.role === 'user') {
        setAnswerMsgIds((prev) => new Set(prev).add(last.id))
        pendingAnswer.current = false
      }
    }
  }, [messages])

  const handleAnswers = useCallback(
    (msgId: string, questions: BAQuestion[], answers: Record<string, string | string[]>) => {
      setAnsweredMap((prev) => ({ ...prev, [msgId]: { questions, answers } }))

      const lines: string[] = []
      for (const q of questions) {
        const val = answers[q.id]
        const display = Array.isArray(val) ? val.join(', ') : val
        if (display) lines.push(`${q.question}: ${display}`)
      }
      const text = lines.join('\n')

      pendingAnswer.current = true
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
            <p className={styles.subtitle}>BMAD · claude-sonnet-4.6 via OpenRouter · web search</p>
          </div>
        </div>
        <PhaseBar current={currentPhase} />
      </header>

      {/* Body: chat column ── */}
      <div className={styles.body}>
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

        {messages.map((msg) => {
          const isLastQuestionsMsg = msg.id === lastQuestionsMessageId

          const isAnswerMsg = msg.role === 'user' && (
            answerMsgIds.has(msg.id) ||
            restoredAnswerMsgIds.has(msg.id) ||
            (pendingAnswer.current && msg === messages[messages.length - 1])
          )
          if (isAnswerMsg) return null

          return (
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
                {/* Image preview (user messages with file parts) */}
                {msg.role === 'user' && msg.parts
                  .filter((p): p is { type: 'file'; mediaType: string; url: string } =>
                    p.type === 'file' && (p as { mediaType?: string }).mediaType?.startsWith('image/') === true
                  )
                  .map((fp, i) => (
                    <img key={i} src={fp.url} alt="Attached" className={styles.imagePreview} />
                  ))
                }

                {/* Render parts in the order the LLM returned them */}
                {(() => {
                  let hasRendered = false
                  return msg.parts.map((part, i) => {
                    if (part.type === 'step-start') return null

                    if (part.type === 'text') {
                      const text = (part as { type: 'text'; text: string }).text
                      if (!text && msg.role !== 'assistant') return null
                      hasRendered = true
                      return (
                        <div
                          key={i}
                          className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}
                        >
                          {text ? (
                            msg.role === 'assistant' ? (
                              <MarkdownMessage content={text} accentColor="var(--ba-accent)" />
                            ) : (
                              text
                            )
                          ) : null}
                        </div>
                      )
                    }

                    const toolInv = getToolInvocationFromPart(part as Record<string, unknown>)
                    if (toolInv) {
                      if (toolInv.toolName === 'askQuestions') {
                        const isMessageAnswered = !!(answeredMap[msg.id] ?? restoredAnswered[msg.id])
                        if (!toolInv.isDone && isStreaming && !isMessageAnswered) {
                          hasRendered = true
                          return (
                            <div key={toolInv.toolCallId || i} className={styles.preparingQuestions}>
                              <span className={styles.searchSpinner} />
                              <span>Preparing questions…</span>
                            </div>
                          )
                        }
                        return null
                      }
                      hasRendered = true
                      return <ToolCallCard key={toolInv.toolCallId || i} inv={toolInv} />
                    }

                    if (part.type === 'data-ba-questions' && msg.role === 'assistant') {
                      const data = (part as { type: string; data: BADataPart }).data
                      const brief = data?.brief
                      if (brief) {
                        hasRendered = true
                        return <BriefCard key={i} brief={brief} />
                      }

                      const answered = answeredMap[msg.id] ?? restoredAnswered[msg.id]
                      if (answered && (data?.questions ?? []).length > 0) {
                        hasRendered = true
                        return (
                          <AnsweredQuestionsCard
                            key={i}
                            questions={answered.questions}
                            answers={answered.answers}
                          />
                        )
                      }

                      if (isLastQuestionsMsg && !isStreaming && (data?.questions ?? []).length > 0) {
                        hasRendered = true
                        return (
                          <QuestionsPanel
                            key={i}
                            questions={data.questions}
                            onSubmit={(answers) => handleAnswers(msg.id, data.questions, answers)}
                            disabled={isStreaming}
                          />
                        )
                      }
                      return null
                    }

                    return null
                  }).concat(
                    msg.role === 'assistant' && isStreaming && !hasRendered
                      ? [<div key="typing" className={`${styles.bubble} ${styles.assistantBubble}`}><span className={styles.typing}><span /><span /><span /></span></div>]
                      : []
                  )
                })()}
              </div>
            </div>
          )
        })}

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
              hasActiveQuestions
                ? 'Or type a free-form response…'
                : 'Describe your idea or ask anything…'
            }
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              className={styles.stopBtn}
              onClick={stop}
              aria-label="Stop"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim() && !imageData}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </form>
        <p className={styles.footerNote}>BA Brainstorm · BMAD method · Powered by claude-sonnet-4.6 via OpenRouter</p>
        </footer>
        </div>{/* end chatArea */}

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
