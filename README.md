# TechCafe — Mastra cleaning agents demo

Two instruction-style agents (bad vs good prompts) and one RAG agent over PDFs in `documents/`, runnable in **Mastra Studio**.

## Prerequisites

- Node.js 20+
- [OpenRouter](https://openrouter.ai/) API key (`OPENROUTER_API_KEY`)

Chat models use the Mastra model router: **`openrouter/openai/gpt-5.4-nano`**. Embeddings call OpenRouter’s OpenAI-compatible `/v1/embeddings` endpoint with `openai/text-embedding-3-small` (same API key).

**Memory:** All agents use `@mastra/memory` with the last **20** messages per thread and **auto thread titles**. Data is stored in `./vector-db/mastra-storage.db` (separate from RAG vectors in `cleaning.db`).

## Setup

```bash
cp .env.example .env
# Edit .env and set OPENROUTER_API_KEY

npm install
npm run seed   # chunk + embed PDFs into ./vector-db/cleaning.db
npm run dev    # Studio → http://localhost:4111
```

## Agents (Studio)

| Agent | Purpose |
|--------|---------|
| **Bad Instruction (Cleaning)** | Vague prompt — compare answers to the good agent |
| **Good Instruction (Cleaning)** | Role / Task / Boundaries / Output |
| **RAG Cleaning Knowledge** | Uses `search-cleaning-knowledge` vector tool on indexed PDFs |

## Try in Studio

- Same question to bad vs good agents, e.g. *“How should I handle cellulosic browning on carpet?”*
- RAG agent: *“What is the mix ratio for T & G LF on tile?”* — watch the retrieval tool call and grounded answer.

## Layout

- `src/mastra/index.ts` — Mastra app + storage + LibSQL vector store
- `src/mastra/storage.ts` / `agent-memory.ts` — LibSQL + shared `Memory` config
- `src/mastra/agents/` — agents
- `src/mastra/tools/cleaning-knowledge-tool.ts` — `createVectorQueryTool`
- `scripts/seed.ts` — PDF → chunks → embeddings → LibSQL
