import { createTool } from '@mastra/core/tools'
import { tavily } from '@tavily/core'
import { z } from 'zod'

const client = tavily({ apiKey: process.env.TAVILY_API_KEY ?? '' })

export const webSearchTool = createTool({
  id: 'webSearch',
  description:
    'Search the web for current information: market trends, competitor products, user research, industry standards, tech stacks, pricing models. Use this to ground product ideas in real-world context.',
  inputSchema: z.object({
    query: z.string().describe('Focused search query (be specific for better results)'),
    maxResults: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    answer: z.string().optional().describe('AI-synthesized answer from search results'),
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => {
    const { query, maxResults = 5 } = inputData

    const response = await client.search(query, {
      maxResults,
      includeAnswer: true,
    })

    return {
      answer: typeof response.answer === 'string' ? response.answer : undefined,
      results: (response.results ?? []).slice(0, maxResults).map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: r.content ?? '',
      })),
    }
  },
})
