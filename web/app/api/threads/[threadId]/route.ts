import { NextRequest, NextResponse } from 'next/server'

const MASTRA_URL = process.env.MASTRA_URL ?? 'http://localhost:4111'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params

  const res = await fetch(`${MASTRA_URL}/api/memory/threads/${threadId}?agentId=baAgent`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status })
  }

  return NextResponse.json({ success: true })
}
