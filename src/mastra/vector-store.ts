import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LibSQLVector } from '@mastra/libsql'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dbFile = path.join(projectRoot, 'vector-db', 'cleaning.db')

/** File-based LibSQL DB for local demo (no external services). */
export const libsqlVector = new LibSQLVector({
  id: 'libsql-vector',
  url: `file:${dbFile}`,
})
