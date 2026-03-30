import { createVectorQueryTool } from '@mastra/rag'

import { HR_DOCS_INDEX, createOpenRouterEmbeddingModel } from '../config.js'

const embeddingModel = createOpenRouterEmbeddingModel()

/**
 * Semantic search over indexed HR / employee-benefits PDFs (seeded via npm run seed).
 * Registered vector store key must match Mastra `vectors` (see index.ts).
 */
export const cleaningKnowledgeTool = createVectorQueryTool({
  vectorStoreName: 'libsqlVector',
  indexName: HR_DOCS_INDEX,
  model: embeddingModel,
  id: 'search-hr-knowledge',
  description:
    'Search the KMS HR knowledge base (company handbook, health insurance benefits & claim forms, overtime policy). Call this before answering any employee questions about policies, benefits, or procedures.',
})
