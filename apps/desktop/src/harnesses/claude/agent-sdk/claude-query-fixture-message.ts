import type {
  ApiKeySource,
  SDKAssistantMessageError,
  SDKMessage,
} from '@anthropic-ai/claude-agent-sdk'

export function assistantMessage(text: string): SDKMessage {
  return {
    type: 'assistant',
    uuid: '00000000-0000-0000-0000-000000000002',
    session_id: 'native-1',
    message: { content: [{ type: 'text', text }] },
  } as unknown as SDKMessage
}

export function initMessage(apiKeySource: ApiKeySource): SDKMessage {
  return {
    type: 'system',
    subtype: 'init',
    apiKeySource,
    claude_code_version: '0.0.0',
    cwd: '/repository',
    tools: [],
    mcp_servers: [],
    model: 'claude-fable-5',
    permissionMode: 'default',
    slash_commands: [],
    output_style: 'default',
    skills: [],
    plugins: [],
    uuid: '00000000-0000-0000-0000-000000000000',
    session_id: 'native-1',
  } as SDKMessage
}

export function assistantErrorMessage(error: SDKAssistantMessageError): SDKMessage {
  return {
    type: 'assistant',
    error,
    uuid: '00000000-0000-0000-0000-000000000001',
    session_id: 'native-1',
  } as unknown as SDKMessage
}
