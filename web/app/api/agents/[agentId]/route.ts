import { NextRequest } from 'next/server'

const MASTRA_URL = process.env.MASTRA_URL ?? 'http://localhost:4111'

/**
 * Proxies to Mastra's AI SDK-compatible chatRoute.
 * The chatRoute streams in AI SDK data-stream protocol, so useChat() on the
 * frontend can consume it directly with tool-call parts.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params

  const upstreamRes = await fetch(`${MASTRA_URL}/chat/${agentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: req.body,
    // @ts-expect-error — Next.js supports duplex on server
    duplex: 'half',
  })

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
