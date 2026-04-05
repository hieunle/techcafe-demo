export interface AgentDef {
  id: string
  name: string
  description: string
  model: string
  color: string
  /** 'stream' = normal SSE chat  |  'ba' = structured-output BA chat */
  type: 'stream' | 'ba'
  tags: string[]
  placeholder: string
  emptyTitle: string
  emptyHint: string
}

export const agents: AgentDef[] = [
  {
    id: 'rag-agent',
    name: 'HR Knowledge',
    description: 'Answers HR policies & benefits using RAG over indexed documents.',
    model: 'GPT (via OpenRouter)',
    color: '#6c63ff',
    type: 'stream',
    tags: ['RAG', 'Memory', 'Tools'],
    placeholder: 'Ask about HR policies, benefits, overtime…',
    emptyTitle: 'Ask about HR policies',
    emptyHint: 'Try: "What is the health insurance claim procedure?"',
  },
  {
    id: 'ba-agent',
    name: 'BA Brainstorm',
    description: 'Guides product ideation through the BMAD method with live web search.',
    model: 'Claude Haiku 4.5',
    color: '#a855f7',
    type: 'ba',
    tags: ['BMAD', 'Web Search', 'Structured Output', 'Multimodal'],
    placeholder: 'Describe your idea or ask anything…',
    emptyTitle: "What's your product idea?",
    emptyHint: 'Describe it in a sentence — I\'ll guide you through the rest.',
  },
  {
    id: 'good-instruction-agent',
    name: 'Good Instructions',
    description: 'Demo of a well-crafted HR agent with clear role, boundaries and output format.',
    model: 'GPT (via OpenRouter)',
    color: '#22c55e',
    type: 'stream',
    tags: ['Demo', 'Best Practice'],
    placeholder: 'Ask an HR question…',
    emptyTitle: 'Well-crafted instructions',
    emptyHint: 'Try: "How do I submit a health insurance claim?"',
  },
  {
    id: 'bad-instruction-agent',
    name: 'Bad Instructions',
    description: 'Demo of an HR agent with intentionally vague, poorly-crafted instructions.',
    model: 'GPT (via OpenRouter)',
    color: '#ef4444',
    type: 'stream',
    tags: ['Demo', 'Anti-pattern'],
    placeholder: 'Ask an HR question…',
    emptyTitle: 'Vague instructions demo',
    emptyHint: 'Ask the same question as the Good Instructions agent to compare.',
  },
]

export function getAgent(id: string): AgentDef | undefined {
  return agents.find((a) => a.id === id)
}
