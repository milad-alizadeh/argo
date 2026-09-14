import {
  sessionAcceptedReplySchema,
  sessionFeedCancelRequestSchema,
  sessionFeedReplySchema,
  sessionFeedRequestSchema,
  sessionFileReplySchema,
  sessionFileRequestSchema,
} from './contract'

export const SESSION_READ_OPERATIONS = {
  feed: {
    name: 'session.feed',
    channel: 'argo:session:feed',
    request: sessionFeedRequestSchema,
    reply: sessionFeedReplySchema,
  },
  file: {
    name: 'session.file.read',
    channel: 'argo:session:file:read',
    request: sessionFileRequestSchema,
    reply: sessionFileReplySchema,
  },
  cancelFeed: {
    name: 'session.feed.cancel',
    channel: 'argo:session:feed:cancel',
    request: sessionFeedCancelRequestSchema,
    reply: sessionAcceptedReplySchema,
  },
} as const
