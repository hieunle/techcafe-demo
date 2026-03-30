import { Agent } from '@mastra/core/agent'

import { agentMemory } from '../agent-memory.js'
import { DEMO_CHAT_MODEL } from '../config.js'
import { cleaningKnowledgeTool } from '../tools/cleaning-knowledge-tool.js'

/**
 * RAG demo: model decides when to retrieve; Studio shows tool calls + context.
 */
export const ragAgent = new Agent({
  id: 'rag-agent',
  name: 'RAG HR Knowledge',
  instructions: `
You answer questions about KMS employee policies and benefits using the HR knowledge base tool.

Rules:
- For any question about policies, health insurance, claim procedures, overtime, or company benefits:
  call the HR knowledge search tool first with a short, focused queryText (and topK around 5–8).
- Base factual claims only on retrieved passages; if the tool returns nothing useful, say you could not find it in the docs.
- After retrieval, synthesize a clear answer. Mention document source titles from metadata when helpful.
- If the source includes deadlines, limits, or eligibility criteria, always include them.
`,
  model: DEMO_CHAT_MODEL,
  memory: agentMemory,
  tools: { cleaningKnowledgeTool },
})
