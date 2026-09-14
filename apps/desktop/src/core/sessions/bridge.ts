import { type BrowserWindow, dialog } from 'electron'
import { registerDomainHandlers } from '../contract/domain'
import { type AttachmentsStore, chooseAttachments, statAttachments } from './attachments'
import {
  type SessionArchiveListReply,
  type SessionArchiveListRequest,
  type SessionDelegationUsageReply,
  type SessionDelegationUsageRequest,
  type SessionFeedReply,
  type SessionFeedRequest,
  type SessionListReply,
  type SessionListRequest,
  type SessionRenameReply,
  type SessionRenameRequest,
  type SessionShellOutputReply,
  type SessionShellOutputRequest,
  sessionError,
} from './contract'
import {
  compactSession,
  decideSessionPermission,
  decideSessionQuestion,
  handoffSession,
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
  archiveList(request: SessionArchiveListRequest): Promise<SessionArchiveListReply>
  readSessionFeed(request: SessionFeedRequest): Promise<SessionFeedReply>
  readShellOutput(request: SessionShellOutputRequest): Promise<SessionShellOutputReply>
  readDelegationUsage(request: SessionDelegationUsageRequest): Promise<SessionDelegationUsageReply>
  renameSession(request: SessionRenameRequest): Promise<SessionRenameReply>
  ownerCliFor(sessionId: string): Promise<string | undefined>
}

type SessionContext = {
  adapters: SessionDriveAdapters
  reader: SessionReader
  attachments: AttachmentsStore
}

// The multi-file/folder chooser for attachments, opened over the same window every other Session
// dialog opens over. Cancelling is not a failure: it hands back no paths, the same as choosing
// none. A chosen folder attaches the same way a file does, as an `@path` reference (#1845).
async function chooseAttachmentFiles(window: BrowserWindow): Promise<string[]> {
  const chosen = await dialog.showOpenDialog(window, {
    title: 'Attach Files & Folders',
    buttonLabel: 'Attach',
    properties: ['openFile', 'openDirectory', 'multiSelections'],
  })
  return chosen.canceled ? [] : chosen.filePaths
}

function ownerContext(context: SessionContext): OwnerContext {
  return { adapters: context.adapters, ownerCliFor: context.reader.ownerCliFor }
}

// The same renderer authority the Project bridge asserts: the main frame of this window, on the
// renderer URL this app loaded. A page that navigated away holds no Session.
export function attachSessionBridge(
  window: BrowserWindow,
  storage: Omit<SessionContext, 'attachments'> & { rendererURL: string },
): void {
  const context: SessionContext & { rendererURL: string } = {
    ...storage,
    attachments: { chooseFiles: () => chooseAttachmentFiles(window) },
  }
  registerDomainHandlers({
    window,
    rendererURL: context.rendererURL,
    operations: SESSION_OPERATIONS,
    context,
    handlers: {
      list: (request, context) => context.reader.listSessions(request),
      archiveList: (request, context) => context.reader.archiveList(request),
      feed: (request, context) => context.reader.readSessionFeed(request),
      shellOutput: (request, context) => context.reader.readShellOutput(request),
      delegationUsage: (request, context) => context.reader.readDelegationUsage(request),
      rename: (request, context) => context.reader.renameSession(request),
      start: (request, context) => startSession(request, context.adapters),
      send: (request, context) => sendSession(request, ownerContext(context)),
      interrupt: (request, context) => interruptSession(request, ownerContext(context)),
      compact: (request, context) => compactSession(request, ownerContext(context)),
      handoff: (request, context) => handoffSession(request, ownerContext(context)),
      readPermission: (request, context) => readSessionPermission(request, ownerContext(context)),
      decidePermission: (request, context) =>
        decideSessionPermission(request, ownerContext(context)),
      decideQuestion: (request, context) => decideSessionQuestion(request, ownerContext(context)),
      chooseAttachments: (request, context) => chooseAttachments(request, context.attachments),
      statAttachments: (request) => statAttachments(request),
    },
    error: sessionError,
  })
}
