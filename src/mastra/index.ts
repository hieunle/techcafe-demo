import { Mastra } from '@mastra/core'
import { chatRoute } from '@mastra/ai-sdk'

import { badInstructionAgent } from './agents/bad-instruction-agent.js'
import { baAgent } from './agents/ba-agent.js'
import { baResearchAgent } from './agents/ba-research-agent.js'
import { goodInstructionAgent } from './agents/good-instruction-agent.js'
import { ragAgent } from './agents/rag-agent.js'
// import { hrMCPServer } from './mcp-server.js'
import { mastraStorage } from './storage.js'
import { libsqlVector } from './vector-store.js'

export const mastra = new Mastra({
  storage: mastraStorage,
  agents: {
    badInstructionAgent,
    goodInstructionAgent,
    ragAgent,
    baAgent,
    baResearchAgent,
  },
  vectors: { libsqlVector },
  // mcpServers: {
  //   hrMCPServer,
  // },
  server: {
    cors: {
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    },
    apiRoutes: [
      // AI SDK-compatible chat routes for streaming agents
      chatRoute({ path: '/chat/rag-agent', agent: 'ragAgent' }),
      chatRoute({ path: '/chat/good-instruction-agent', agent: 'goodInstructionAgent' }),
      chatRoute({ path: '/chat/bad-instruction-agent', agent: 'badInstructionAgent' }),
      chatRoute({ path: '/chat/ba-agent', agent: 'baAgent' }),
    ],
  },
})
