import type { BrowserWindow } from 'electron'
import { registerDomainHandlers } from '../contract/domain'
import {
  type SessionFeedReply,
  type SessionFeedRequest,
  type SessionListReply,
  type SessionListRequest,
  type SessionRenameReply,
  type SessionRenameRequest,
  sessionError,
} from './contract'
import {
  compactSession,
  decideSessionPermission,
  decideSessionQuestion,
  interruptSession,
  type OwnerContext,
  readSessionPermission,
  sendSession,
  startSession,
} from './drive'
import { SESSION_OPERATIONS } from './operations'
import type { SessionDriveAdapters } from './session-drive-adapter'

export type SessionReader = {
  listSessions(request: SessionListRequest): Promise<SessionListReply>
  readSessionFeed(request: SessionFeedRequest): Promise<SessionFeedReply>
  renameSession(request: SessionRenameRequest): Promise<SessionRenameReply>
  ownerCliFor(sessionId: string): Promise<string | undefined>
}

type SessionContext = {
  adapters: SessionDriveAdapters
  reader: SessionReader
}

function ownerContext(context: SessionContext): OwnerContext {
  return { adapters: context.adapters, ownerCliFor: context.reader.ownerCliFor }
}

// The same renderer authority the Project bridge asserts: the main frame of this window, on the
// renderer URL this app loaded. A page that navigated away holds no Session.
export function attachSessionBridge(
  window: BrowserWindow,
  storage: SessionContext & { rendererURL: string },
): void {
  registerDomainHandlers({
    window,
    rendererURL: storage.rendererURL,
    operations: SESSION_OPERATIONS,
    context: storage,
    handlers: {
      list: (request, context) => context.reader.listSessions(request),
      feed: (request, context) => context.reader.readSessionFeed(request),
      rename: (request, context) => context.reader.renameSession(request),
      start: (request, context) => startSession(request, context.adapters),
      send: (request, context) => sendSession(request, ownerContext(context)),
      interrupt: (request, context) => interruptSession(request, ownerContext(context)),
      compact: (request, context) => compactSession(request, ownerContext(context)),
      readPermission: (request, context) => readSessionPermission(request, ownerContext(context)),
      decidePermission: (request, context) =>
        decideSessionPermission(request, ownerContext(context)),
      decideQuestion: (request, context) => decideSessionQuestion(request, ownerContext(context)),
    },
    error: sessionError,
  })
}
