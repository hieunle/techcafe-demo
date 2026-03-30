import 'dotenv/config'

import { hrMCPServer } from '../src/mastra/mcp-server.js'

await hrMCPServer.startStdio()
