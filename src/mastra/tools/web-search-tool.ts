import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

interface UrlCitationAnnotation {
  type: 'url_citation'
  url_citation: {
    url: string
    title: string
    content?: string
  }
}

/**
 * Web search via OpenRouter's `openrouter:web_search` server tool.
 *
 * Uses the same OPENROUTER_API_KEY — no extra credentials needed.
 * Engine defaults to `auto`: uses the provider's native search when available,
 * otherwise falls back to Exa. The model decides when and how many times
 * to search within a single call.
 */
export const webSearchTool = createTool({
  id: 'webSearch',
  description:
    'Search the web for current information: market trends, competitor products, user research, industry standards, tech stacks, pricing models. Use this to ground product ideas in real-world context.',
  inputSchema: z.object({
    query: z.string().describe('Focused search query (be specific for better results)'),
    maxResults: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    answer: z.string().describe('AI-synthesized answer grounded in live search results'),
    sources: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
      }),
    ),
    searchCount: z.number().describe('Number of web searches the model performed'),
  }),
  execute: async (inputData) => {
    const { query, maxResults = 5 } = inputData

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/techcafe-demo',
        'X-Title': 'TechCafe BA Demo',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.4-nano',
        messages: [
          {
            role: 'user',
            content: `Research the following and provide a concise, factual summary with key insights: ${query}`,
          },
        ],
        tools: [
          {
            type: 'openrouter:web_search',
            parameters: {
              engine: 'auto',        // native provider search → Exa fallback
              max_results: maxResults,
              max_total_results: maxResults * 2, // cap total across multiple searches
              search_context_size: 'medium',
            },
          },
        ],
      }),
    })

    if (!res.ok) {
      throw new Error(`OpenRouter web search failed: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    const message = data.choices?.[0]?.message ?? {}
    const answer: string = message.content ?? 'No results found.'

    const sources = ((message.annotations ?? []) as UrlCitationAnnotation[])
      .filter((a) => a.type === 'url_citation')
      .map((a) => ({
        url: a.url_citation.url,
        title: a.url_citation.title ?? a.url_citation.url,
      }))
      .filter((s) => s.url)
      .slice(0, maxResults)

    const searchCount: number =
      data.usage?.server_tool_use?.web_search_requests ?? 0

    return { answer, sources, searchCount }
  },
})
