import { Mastra } from '@mastra/core'

import { badInstructionAgent } from './agents/bad-instruction-agent.js'
import { goodInstructionAgent } from './agents/good-instruction-agent.js'
import { ragAgent } from './agents/rag-agent.js'
import { mastraStorage } from './storage.js'
import { libsqlVector } from './vector-store.js'

export const mastra = new Mastra({
  storage: mastraStorage,
  agents: {
    badInstructionAgent,
    goodInstructionAgent,
    ragAgent,
  },
  vectors: { libsqlVector },
})
