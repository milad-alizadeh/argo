import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import {
  type SessionAcceptedReply,
  type SessionArchiveListReply,
  type SessionArchiveSetReply,
  type SessionChooseAttachmentsReply,
  type SessionFeedReply,
  type SessionFileReply,
  type SessionListReply,
  type SessionPermissionDecisionRequest,
  type SessionPermissionReply,
  type SessionRenameReply,
  type SessionSearchReply,
  type SessionShellOutputReply,
  type SessionSkillReply,
  type SessionStartReply,
  type SessionStatAttachmentsReply,
  type SessionSubagentUsageReply,
  type SessionUnreadFocusReply,
  sessionError,
} from '@/domains/sessions/contract/ipc/contract'
import { SESSION_OPERATIONS } from '@/domains/sessions/contract/ipc/operations'
import type { RosterStatus } from '@/domains/sessions/contract/ipc/search-contract'
import { createDomainClient } from '@/shared/ipc/client'

export type SessionHarnessent = {
  startSession(request: {
    harness: string
    cwd: string
    prompt: string
    deferInitialTurn?: boolean
    setup?: unknown
    attachments?: SessionAttachmentInput[]
  }): Promise<SessionStartReply>
  sendSession(request: {
    sessionId: string
    prompt: string
    setup?: unknown
    attachments?: SessionAttachmentInput[]
  }): Promise<SessionAcceptedReply>
  steerSession(request: {
    sessionId: string
    prompt: string
    attachments?: SessionAttachmentInput[]
  }): Promise<SessionAcceptedReply>
  interruptSession(request: { sessionId: string }): Promise<SessionAcceptedReply>
  compactSession(request: { sessionId: string }): Promise<SessionAcceptedReply>
  handoffSession(request: { sessionId: string }): Promise<SessionAcceptedReply>
  readSessionPermission(request: { sessionId: string }): Promise<SessionPermissionReply>
  decideSessionPermission(request: {
    sessionId: string
    permissionId: string
    decision: SessionPermissionDecisionRequest['decision']
  }): Promise<SessionAcceptedReply>
  decideSessionQuestion(request: {
    sessionId: string
    questionId: string
    answers: QuestionAnswer[]
  }): Promise<SessionAcceptedReply>
  listSessions(request: {
    projectRoot: string | null
    cursor?: string | null
  }): Promise<SessionListReply>
  listArchivedSessions(request: {
    cursor: string | null
    restoreId: string | null
  }): Promise<SessionArchiveListReply>
  setSessionsArchived(request: {
    sessionIds: string[]
    archived: boolean
  }): Promise<SessionArchiveSetReply>
  searchSessions(request: {
    projectRoot: string | null
    status: RosterStatus
    query: string
    cursor: string | null
  }): Promise<SessionSearchReply>
  readSessionFeed(request: {
    sessionId: string
    subagentId: string | null
    revision: string | null
  }): Promise<SessionFeedReply>
  readWorkspaceFile(request: { sessionId: string; path: string }): Promise<SessionFileReply>
  readSkillFile(request: { path: string }): Promise<SessionSkillReply>
  cancelSessionFeed(request: { sessionId: string }): Promise<SessionAcceptedReply>
  readShellOutput(request: { sessionId: string; shellId: string }): Promise<SessionShellOutputReply>
  readSubagentUsage(request: { sessionId: string }): Promise<SessionSubagentUsageReply>
  renameSession(request: { sessionId: string; name: string }): Promise<SessionRenameReply>
  focusSessionUnread(request: { sessionId: string }): Promise<SessionUnreadFocusReply>
  connectSessionTicket(request: {
    sessionId: string
    projectId: string
    key: string
    title: string
    state: 'open' | 'closed'
  }): Promise<SessionAcceptedReply>
  disconnectSessionTicket(request: { sessionId: string }): Promise<SessionAcceptedReply>
  chooseSessionAttachments(): Promise<SessionChooseAttachmentsReply>
  statSessionAttachments(request: { paths: string[] }): Promise<SessionStatAttachmentsReply>
}

export function createSessionHarnessent(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): SessionHarnessent {
  const client = createDomainClient(SESSION_OPERATIONS, invoke, sessionError)
  return {
    startSession: (request) => client.start(request),
    sendSession: (request) => client.send(request),
    steerSession: (request) => client.steer(request),
    interruptSession: (request) => client.interrupt(request),
    compactSession: (request) => client.compact(request),
    handoffSession: (request) => client.handoff(request),
    readSessionPermission: (request) => client.readPermission(request),
    decideSessionPermission: (request) => client.decidePermission(request),
    decideSessionQuestion: (request) => client.decideQuestion(request),
    listSessions: (request) => client.list(request),
    listArchivedSessions: (request) => client.archiveList(request),
    setSessionsArchived: (request) => client.archiveSet(request),
    searchSessions: (request) => client.search(request),
    readWorkspaceFile: (request) => client.file(request),
    readSkillFile: (request) => client.skill(request),
    readShellOutput: (request) => client.shellOutput(request),
    readSubagentUsage: (request) => client.subagentUsage(request),
    renameSession: (request) => client.rename(request),
    focusSessionUnread: (request) => client.focusUnread(request),
    connectSessionTicket: (request) => client.connectTicket(request),
    disconnectSessionTicket: (request) => client.disconnectTicket(request),
    chooseSessionAttachments: () => client.chooseAttachments(),
    statSessionAttachments: (request) => client.statAttachments(request),
    async readSessionFeed(request) {
      const reply = await client.feed(request)
      // A Feed that answers for a different Session would draw one Session's history under
      // another's name, so the identity is checked and not assumed.
      if (reply.type === 'session.feed.read' && reply.sessionId !== request.sessionId) {
        return sessionError('invalid-response', reply.requestId)
      }
      return reply
    },
    cancelSessionFeed: (request) => client.cancelFeed(request),
  }
}
