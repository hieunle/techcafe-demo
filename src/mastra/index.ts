import { Mastra } from '@mastra/core'
import { registerApiRoute } from '@mastra/core/server'

import { badInstructionAgent } from './agents/bad-instruction-agent.js'
import { baAgent, baResponseSchema } from './agents/ba-agent.js'
import { goodInstructionAgent } from './agents/good-instruction-agent.js'
import { ragAgent } from './agents/rag-agent.js'
import { hrMCPServer } from './mcp-server.js'
import { mastraStorage } from './storage.js'
import { libsqlVector } from './vector-store.js'

export const mastra = new Mastra({
  storage: mastraStorage,
  agents: {
    badInstructionAgent,
    goodInstructionAgent,
    ragAgent,
    baAgent,
  },
  vectors: { libsqlVector },
  mcpServers: {
    hrMCPServer,
  },
  server: {
    cors: {
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    },
    apiRoutes: [
      registerApiRoute('/ba/generate', {
        method: 'POST',
        handler: async (c: { req: { json: () => Promise<{ messages: unknown[] }> }; get: (key: string) => { getAgent: (id: string) => { generate: (messages: unknown[], opts: unknown) => Promise<{ object: unknown }> } }; json: (data: unknown) => Response }) => {
          const { messages } = await c.req.json()
          const mastraInstance = c.get('mastra')
          const agent = mastraInstance.getAgent('baAgent')

          const response = await agent.generate(messages, {
            structuredOutput: {
              schema: baResponseSchema,
              // Required for Anthropic models when tools are present
              jsonPromptInjection: true,
            },
          })

          return c.json(response.object)
        },
      }),
    ],
  },
})
