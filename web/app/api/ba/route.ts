import { NextRequest } from 'next/server'

const MASTRA_URL = process.env.MASTRA_URL ?? 'http://localhost:4111'

export async function POST(req: NextRequest) {
  const body = await req.json()

  const res = await fetch(`${MASTRA_URL}/ba/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    return new Response(JSON.stringify({ error }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = await res.json()
  return Response.json(data)
}
