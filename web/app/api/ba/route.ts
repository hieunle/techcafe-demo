import { NextRequest } from 'next/server'

const MASTRA_URL = process.env.MASTRA_URL ?? 'http://localhost:4111'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { messages, threadId } = body

  const upstreamRes = await fetch(
    `${MASTRA_URL}/api/agents/ba-agent/stream`,
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
      'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
