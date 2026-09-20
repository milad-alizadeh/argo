import {
  sessionUnreadFocusReplySchema,
  sessionUnreadFocusRequestSchema,
} from '@/domains/sessions/contract/ipc/contract'

export const SESSION_UNREAD_OPERATIONS = {
  focusUnread: {
    name: 'session.unread.focus',
    channel: 'argo:session:unread:focus',
    request: sessionUnreadFocusRequestSchema,
    reply: sessionUnreadFocusReplySchema,
  },
} as const
