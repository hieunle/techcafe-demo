import { Memory } from '@mastra/memory'

import { mastraStorage } from './storage.js'

/**
 * Conversation memory for all demo agents: thread history in Studio + short context window.
 */
export const agentMemory = new Memory({
  storage: mastraStorage,
  options: {
    lastMessages: 20,
    generateTitle: true,
  },
})
