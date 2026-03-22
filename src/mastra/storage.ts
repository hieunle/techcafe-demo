import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LibSQLStore } from '@mastra/libsql'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Shared LibSQL persistence for Mastra (memory threads/messages) and Studio.
 * RAG document vectors stay in {@link ./vector-store.ts} (`cleaning.db`).
 */
export const mastraStorage = new LibSQLStore({
  id: 'mastra-libsql-storage',
  url: `file:${path.join(projectRoot, 'vector-db', 'mastra-storage.db')}`,
})
