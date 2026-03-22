import { createVectorQueryTool } from '@mastra/rag'

import { CLEANING_DOCS_INDEX, createOpenRouterEmbeddingModel } from '../config.js'

const embeddingModel = createOpenRouterEmbeddingModel()

/**
 * Semantic search over indexed cleaning training PDFs (seeded via npm run seed).
 * Registered vector store key must match Mastra \`vectors\` (see index.ts).
 */
export const cleaningKnowledgeTool = createVectorQueryTool({
  vectorStoreName: 'libsqlVector',
  indexName: CLEANING_DOCS_INDEX,
  model: embeddingModel,
  id: 'search-cleaning-knowledge',
  description:
    'Search Electrodry cleaning knowledge base (training PDFs): carpet & tile procedures, products, mixing ratios, fibre types, stains, and safety notes. Call this before answering domain questions.',
})
