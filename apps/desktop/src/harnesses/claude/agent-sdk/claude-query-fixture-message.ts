import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

export function assistantMessage(text: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: '00000000-0000-0000-0000-000000000002',
    session_id: 'native-1',
    message: { content: [{ type: 'text', text }] },
  } as unknown as SDKMessage
}
