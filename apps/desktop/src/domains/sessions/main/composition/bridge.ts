import { type BrowserWindow, dialog } from 'electron'
import {
  type SessionAcceptedReply,
  type SessionArchiveListReply,
  type SessionArchiveListRequest,
  type SessionArchiveSetReply,
  type SessionArchiveSetRequest,
  type SessionFeedCancelRequest,
  type SessionFeedReply,
  type SessionFeedRequest,
  type SessionFileReply,
  type SessionFileRequest,
  type SessionListReply,
  type SessionListRequest,
  type SessionRenameReply,
  type SessionRenameRequest,
  type SessionSearchReply,
  type SessionSearchRequest,
  type SessionShellOutputReply,
  type SessionShellOutputRequest,
  type SessionSkillReply,
  type SessionSkillRequest,
  type SessionSubagentUsageReply,
  type SessionSubagentUsageRequest,
  type SessionTicketConnectRequest,
  type SessionTicketDisconnectRequest,
  type SessionUnreadFocusReply,
  type SessionUnreadFocusRequest,
  sessionError,
} from '@/domains/sessions/contract/ipc/contract'
import { SESSION_OPERATIONS } from '@/domains/sessions/contract/ipc/operations'
import type { SessionDriveAdapters } from '@/domains/sessions/contract/session-drive-adapter'
import {
  type AttachmentsStore,
  chooseAttachments,
  statAttachments,
} from '@/domains/sessions/main/drive/attachments'
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
} from '@/domains/sessions/main/drive/drive'
import { steerSession } from '@/domains/sessions/main/drive/steer-session'
import { platformText } from '@/platform/main/i18n'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'

export type SessionReader = {
  listSessions(request: SessionListRequest): Promise<SessionListReply>
  archiveList(request: SessionArchiveListRequest): Promise<SessionArchiveListReply>
  archiveSet(request: SessionArchiveSetRequest): Promise<SessionArchiveSetReply>
  search(request: SessionSearchRequest): Promise<SessionSearchReply>
  readSessionFeed(request: SessionFeedRequest): Promise<SessionFeedReply>
  readWorkspaceFile(request: SessionFileRequest): Promise<SessionFileReply>
  readSkillFile(request: SessionSkillRequest): Promise<SessionSkillReply>
  cancelSessionFeed(request: SessionFeedCancelRequest): Promise<SessionAcceptedReply>
  readShellOutput(request: SessionShellOutputRequest): Promise<SessionShellOutputReply>
  readSubagentUsage(request: SessionSubagentUsageRequest): Promise<SessionSubagentUsageReply>
  renameSession(request: SessionRenameRequest): Promise<SessionRenameReply>
  focusSessionUnread(request: SessionUnreadFocusRequest): Promise<SessionUnreadFocusReply>
  connectTicket(request: SessionTicketConnectRequest): Promise<SessionAcceptedReply>
  disconnectTicket(request: SessionTicketDisconnectRequest): Promise<SessionAcceptedReply>
  ownerHarnessFor(sessionId: string): Promise<string | undefined>
  // A selected Feed still reading, so background indexing (#2373) can pause rather than race it.
  isFeedReadActive(): boolean
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
    title: platformText('dialog.attachFiles.title'),
    buttonLabel: platformText('dialog.attachFiles.confirm'),
    properties: ['openFile', 'openDirectory', 'multiSelections'],
  })
  return chosen.canceled ? [] : chosen.filePaths
}

function ownerContext(context: SessionContext): OwnerContext {
  return { adapters: context.adapters, ownerHarnessFor: context.reader.ownerHarnessFor }
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
      archiveSet: (request, context) => context.reader.archiveSet(request),
      search: (request, context) => context.reader.search(request),
      feed: (request, context) => context.reader.readSessionFeed(request),
      file: (request, context) => context.reader.readWorkspaceFile(request),
      skill: (request, context) => context.reader.readSkillFile(request),
      cancelFeed: (request, context) => context.reader.cancelSessionFeed(request),
      shellOutput: (request, context) => context.reader.readShellOutput(request),
      subagentUsage: (request, context) => context.reader.readSubagentUsage(request),
      rename: (request, context) => context.reader.renameSession(request),
      focusUnread: (request, context) => context.reader.focusSessionUnread(request),
      connectTicket: (request, context) => context.reader.connectTicket(request),
      disconnectTicket: (request, context) => context.reader.disconnectTicket(request),
      start: (request, context) => startSession(request, context.adapters),
      send: (request, context) => sendSession(request, ownerContext(context)),
      steer: (request, context) => steerSession(request, ownerContext(context)),
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
