import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

// Claude Code CLIs that predate this field never emit it, but every CLI a subscription-only
// launch can reach does, so absence here would be a launch bug, not a legitimate unknown.
const SUBSCRIPTION_API_KEY_SOURCE = 'none'

function apiKeySourceOf(message: SDKMessage): string | undefined {
  return message.type === 'system' && message.subtype === 'init' ? message.apiKeySource : undefined
}

export function isSubscriptionAuthorized(message: SDKMessage): boolean {
  return apiKeySourceOf(message) === SUBSCRIPTION_API_KEY_SOURCE
}

export function isInheritedApiCredential(message: SDKMessage): boolean {
  const source = apiKeySourceOf(message)
  return source !== undefined && source !== SUBSCRIPTION_API_KEY_SOURCE
}

export function isAuthenticationFailure(message: SDKMessage): boolean {
  return message.type === 'assistant' && message.error === 'authentication_failed'
}
