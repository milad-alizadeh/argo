import {
  sessionArchiveListReplySchema,
  sessionArchiveListRequestSchema,
  sessionArchiveSetReplySchema,
  sessionArchiveSetRequestSchema,
  sessionSearchReplySchema,
  sessionSearchRequestSchema,
} from './contract'

// The Archive and search operations, apart from the main table for the same reason
// SESSION_READ_OPERATIONS is (read-operations.ts): the flat table hit the file's line cap.
export const SESSION_ARCHIVE_SEARCH_OPERATIONS = {
  archiveList: {
    name: 'session.archive.list',
    channel: 'argo:session:archive:list',
    request: sessionArchiveListRequestSchema,
    reply: sessionArchiveListReplySchema,
  },
  archiveSet: {
    name: 'session.archive.set',
    channel: 'argo:session:archive:set',
    request: sessionArchiveSetRequestSchema,
    reply: sessionArchiveSetReplySchema,
  },
  search: {
    name: 'session.search',
    channel: 'argo:session:search',
    request: sessionSearchRequestSchema,
    reply: sessionSearchReplySchema,
  },
} as const
