import {
  isAuthenticationFailure,
  isInheritedApiCredential,
  isSubscriptionAuthorized,
} from '@/harnesses/claude/agent-sdk/subscription-authorization'
import type { ClaudeSdkMessage } from '@/harnesses/claude/agent-sdk/types'

type MessageParams = { message: ClaudeSdkMessage }

export const claudeSessionGuards = {
  isSubscriptionAuthorized: (_: unknown, params: MessageParams) =>
    isSubscriptionAuthorized(params.message),
  isInheritedApiCredential: (_: unknown, params: MessageParams) =>
    isInheritedApiCredential(params.message),
  isAuthenticationFailure: (_: unknown, params: MessageParams) =>
    isAuthenticationFailure(params.message),
}
