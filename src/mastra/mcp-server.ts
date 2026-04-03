import { MCPServer } from '@mastra/mcp'

import { badInstructionAgent } from './agents/bad-instruction-agent.js'
import { goodInstructionAgent } from './agents/good-instruction-agent.js'
import { ragAgent } from './agents/rag-agent.js'
import { hrKnowledgeTool } from './tools/hr-knowledge-tool.js'

/**
 * MCP server that exposes HR tools and agents to external clients
 * (Cursor, Claude Desktop, Windsurf, or any MCP-compatible client).
 *
 * Transports:
 *  - SSE  → registered in Mastra instance (auto-served at /mcp/:key/sse)
 *  - stdio → run `npm run mcp` for a subprocess-based connection
 */
export const hrMCPServer = new MCPServer({
  id: 'techcafe-hr-mcp',
  name: 'TechCafe HR Knowledge MCP Server',
  version: '1.0.0',
  description: 'Exposes KMS HR knowledge search and HR specialist agents via MCP.',
  tools: { hrKnowledgeTool },
  agents: {
    ragAgent,
  },
})
