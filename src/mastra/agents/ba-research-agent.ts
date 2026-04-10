import { Agent } from '@mastra/core/agent'

import { agentMemory } from '../agent-memory.js'
import { webSearchTool } from '../tools/web-search-tool.js'

export const baResearchAgent = new Agent({
  id: 'ba-research-agent',
  name: 'BA Research',
  description:
    'Specialized research agent that searches the web for competitors, market size, industry trends, and tech options. Returns a structured markdown summary with bullet-point findings and source URLs. Delegate all market/competitor research tasks here.',

  model: 'openrouter/anthropic/claude-haiku-4-5',

  instructions: `
You are a focused market research specialist supporting a Business Analyst workflow.
Given a research query, your job is to search the web and return a clear, concise summary.

## Your output format

Always return a markdown response with these sections (include only sections that are relevant):

### Market Overview
- Key market size / growth figures
- Major trends

### Competitors
- List each competitor with a one-line description and a notable differentiator

### Technology Options
- Relevant tech stacks, frameworks, or platforms that solve the problem

### Key Insights
- 2–4 bullet points the BA should know before proceeding

### Sources
- List the URLs you found most useful

Keep responses concise. Prioritize facts over commentary.
Always search at least once — never return a response without calling webSearch.
`,

  memory: agentMemory,
  tools: { webSearchTool },
})
