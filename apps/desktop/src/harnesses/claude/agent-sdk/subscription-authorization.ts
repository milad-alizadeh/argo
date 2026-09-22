import type { ClaudeSdkMessage } from './types'

// Claude Code CLIs that predate this field never emit it, but every CLI a subscription-only
// launch can reach does, so absence here would be a launch bug, not a legitimate unknown.
const SUBSCRIPTION_API_KEY_SOURCE = 'none'

function apiKeySourceOf(message: ClaudeSdkMessage): string | undefined {
  return message.type === 'system' && message.subtype === 'init' && 'apiKeySource' in message
    ? String(message.apiKeySource)
    : undefined
}

export function isSubscriptionAuthorized(message: ClaudeSdkMessage): boolean {
  return apiKeySourceOf(message) === SUBSCRIPTION_API_KEY_SOURCE
}

export function isInheritedApiCredential(message: ClaudeSdkMessage): boolean {
  const source = apiKeySourceOf(message)
  return source !== undefined && source !== SUBSCRIPTION_API_KEY_SOURCE
}

export function isAuthenticationFailure(message: ClaudeSdkMessage): boolean {
  return message.type === 'assistant' && message.error === 'authentication_failed'
}
