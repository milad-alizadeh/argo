import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'

export const keyOf = (session: SessionIdentity) => `${session.harness}:${session.nativeId}`
