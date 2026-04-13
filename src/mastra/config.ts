import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const HR_DOCS_INDEX = 'hr_docs' as const

/** @deprecated use HR_DOCS_INDEX */
export const CLEANING_DOCS_INDEX = HR_DOCS_INDEX

/** text-embedding-3-small default dimensions */
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Shared OpenRouter provider instance.
 * Uses OPENROUTER_API_KEY from env, with project attribution headers.
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': 'https://github.com/techcafe-demo',
    'X-Title': 'TechCafe Demo',
  },
})

/** Default chat model for all demo agents */
export const DEMO_CHAT_MODEL = openrouter('openai/gpt-5.4-nano')

/** Embeddings via OpenRouter's OpenAI-compatible /embeddings endpoint. */
export function createOpenRouterEmbeddingModel() {
  return openrouter.textEmbeddingModel('openai/text-embedding-3-small')
}
