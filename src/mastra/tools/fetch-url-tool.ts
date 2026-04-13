import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const fetchUrlTool = createTool({
  id: 'fetchUrl',
  description:
    'Fetch and read content from an external URL — web pages, requirement docs, competitor sites, API specs, GitHub READMEs, etc. Use this when the user shares a link or when you need to read a specific page in full.',
  inputSchema: z.object({
    url: z.string().url().describe('The full URL to fetch'),
    maxChars: z.number().optional().default(8000).describe('Maximum characters of content to return (default 8000)'),
  }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
    statusCode: z.number(),
  }),
  execute: async ({ url, maxChars = 8000 }) => {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TechCafe-BA-Agent/1.0' },
    })
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
    return {
      url,
      title: titleMatch?.[1]?.trim() ?? url,
      content: text.slice(0, maxChars),
      statusCode: res.status,
    }
  },
})
