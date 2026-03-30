import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { embedMany } from 'ai'
import { MDocument } from '@mastra/rag'
import pdfParse from 'pdf-parse'

import {
  CLEANING_DOCS_INDEX,
  EMBEDDING_DIMENSIONS,
  createOpenRouterEmbeddingModel,
} from '../src/mastra/config.js'
import { libsqlVector } from '../src/mastra/vector-store.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const documentsDir = path.join(root, 'documents')

const PDF_FILES = [
  'Claim Form - English.pdf',
  'HANBOOK KMS 2026-2027.pdf',
  'Những lưu ý chung bảo hiểm sức khỏe 2026.pdf',
  'PL - Overtime Policy.pdf',
  'Quyền lợi BHSK 2026 (Vietnamese version).pdf',
] as const

async function loadPdfText(filename: string): Promise<string> {
  const buf = await fs.readFile(path.join(documentsDir, filename))
  const data = await pdfParse(buf)
  return data.text?.trim() || ''
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Missing OPENROUTER_API_KEY in environment (.env).')
    process.exit(1)
  }

  console.log('Creating / resetting vector index:', CLEANING_DOCS_INDEX)
  try {
    await libsqlVector.deleteIndex({ indexName: CLEANING_DOCS_INDEX })
  } catch {
    // index may not exist yet
  }
  await libsqlVector.createIndex({
    indexName: CLEANING_DOCS_INDEX,
    dimension: EMBEDDING_DIMENSIONS,
  })

  const embeddingModel = createOpenRouterEmbeddingModel()
  let totalChunks = 0

  for (const file of PDF_FILES) {
    console.log('Processing', file, '...')
    const raw = await loadPdfText(file)
    if (!raw) {
      console.warn('  (no text extracted, skipping)')
      continue
    }

    const doc = MDocument.fromText(raw, { source: file })
    const chunks = await doc.chunk({
      strategy: 'recursive',
      maxSize: 512,
      overlap: 50,
      separators: ['\n\n', '\n', '. '],
    })

    const texts = chunks.map(c => c.text)
    totalChunks += texts.length
    if (texts.length === 0) continue

    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: texts,
    })

    await libsqlVector.upsert({
      indexName: CLEANING_DOCS_INDEX,
      vectors: embeddings,
      metadata: chunks.map(c => ({
        text: c.text,
        source: file,
      })),
    })

    console.log(`  upserted ${texts.length} chunks`)
  }

  console.log('Done. Total chunks indexed:', totalChunks)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
