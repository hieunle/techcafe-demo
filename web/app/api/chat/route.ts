import { NextRequest } from 'next/server'

const MASTRA_URL = process.env.MASTRA_URL ?? 'http://localhost:4111'
const AGENT_ID = 'rag-agent'

export async function POST(req: NextRequest) {
  const { messages, threadId } = await req.json()

  const upstreamRes = await fetch(
    `${MASTRA_URL}/api/agents/${AGENT_ID}/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, threadId, resourceId: threadId }),
    },
  )

  if (!upstreamRes.ok) {
    const error = await upstreamRes.text()
    return new Response(JSON.stringify({ error }), {
      status: upstreamRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(upstreamRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
