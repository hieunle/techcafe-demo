import { NextRequest, NextResponse } from 'next/server'

const MASTRA_URL = process.env.MASTRA_URL ?? 'http://localhost:4111'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const resourceId = searchParams.get('resourceId')

  const url = new URL(`${MASTRA_URL}/api/memory/threads`)
  if (resourceId) url.searchParams.set('resourceId', resourceId)

  const res = await fetch(url.toString())

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const res = await fetch(`${MASTRA_URL}/api/memory/threads?agentId=baAgent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
