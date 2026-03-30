import { ModelRouterEmbeddingModel } from '@mastra/core/llm'

/** OpenRouter chat model for all demo agents */
export const DEMO_CHAT_MODEL = 'openrouter/openai/gpt-5.4-nano' as const

export const HR_DOCS_INDEX = 'hr_docs' as const

/** @deprecated use HR_DOCS_INDEX */
export const CLEANING_DOCS_INDEX = HR_DOCS_INDEX

/** text-embedding-3-small default dimensions */
export const EMBEDDING_DIMENSIONS = 1536

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

/**
 * Embeddings via OpenRouter's OpenAI-compatible `/embeddings` endpoint.
 * ModelRouterEmbeddingModel only accepts `provider/model` (two segments), not `openrouter/.../...`.
 */
export function createOpenRouterEmbeddingModel() {
  return new ModelRouterEmbeddingModel({
    id: 'openai/text-embedding-3-small',
    url: OPENROUTER_BASE,
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      'HTTP-Referer': 'https://github.com/techcafe-demo',
      'X-Title': 'TechCafe Cleaning Demo',
    },
  })
}
