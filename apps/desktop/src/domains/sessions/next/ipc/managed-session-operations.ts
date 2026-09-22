import {
  managedSessionCommandRequestSchema,
  managedSessionReplySchema,
} from '@/domains/sessions/next/ipc/managed-session-contract'

export const MANAGED_SESSION_OPERATIONS = {
  command: {
    name: 'managed-session.command',
    channel: 'argo:managed-session:command',
    request: managedSessionCommandRequestSchema,
    reply: managedSessionReplySchema,
  },
} as const
