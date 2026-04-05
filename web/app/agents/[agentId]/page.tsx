import { notFound } from 'next/navigation'
import Chat from '../../components/chat'
import BAChat from '../../ba/ba-chat'
import { getAgent } from '../registry'

interface Props {
  params: Promise<{ agentId: string }>
}

export default async function AgentPage({ params }: Props) {
  const { agentId } = await params
  const agent = getAgent(agentId)

  if (!agent) notFound()

  if (agent.type === 'ba') {
    return <BAChat />
  }

  return (
    <Chat
      agentId={agent.id}
      title={agent.name}
      subtitle={`${agent.model} · ${agent.tags.join(' · ')}`}
      color={agent.color}
      placeholder={agent.placeholder}
      emptyTitle={agent.emptyTitle}
      emptyHint={agent.emptyHint}
    />
  )
}
