import {
  managedSessionCatalogReply,
  managedSessionCatalogRequestSchema,
  managedSessionCommandRequestSchema,
  managedSessionReplySchema,
  managedSessionSubscribeReplySchema,
  managedSessionSubscribeRequestSchema,
} from '@/domains/sessions/next/ipc/managed-session-contract'

export const MANAGED_SESSION_OPERATIONS = {
  command: {
    name: 'managed-session.command',
    channel: 'argo:managed-session:command',
    request: managedSessionCommandRequestSchema,
    reply: managedSessionReplySchema,
  },
  subscribe: {
    name: 'managed-session.subscribe',
    channel: 'argo:managed-session:subscribe',
    request: managedSessionSubscribeRequestSchema,
    reply: managedSessionSubscribeReplySchema,
  },
  catalog: {
    name: 'managed-session.catalog',
    channel: 'argo:managed-session:catalog',
    request: managedSessionCatalogRequestSchema,
    reply: managedSessionCatalogReply,
  },
} as const
