import { Agent } from '@mastra/core/agent'

import { DEMO_CHAT_MODEL } from '../config.js'
import { agentMemory } from '../agent-memory.js'

/**
 * Intentionally weak instructions (TechCafe slide: vague role, subjective terms, no boundaries, no output shape).
 */
export const badInstructionAgent = new Agent({
  id: 'bad-instruction-agent',
  name: 'Bad Instruction (HR)',
  instructions:
    'You are an HR assistant. Help the user with their questions. Be thorough and professional.',
  model: DEMO_CHAT_MODEL,
  memory: agentMemory,
})
