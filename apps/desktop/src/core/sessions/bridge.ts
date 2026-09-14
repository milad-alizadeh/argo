import type { BrowserWindow } from 'electron'
import type { ClaudeSessionDriver } from '../../agents/claude/drive/claude-session-driver'
import {
  compactClaudeSession,
  interruptClaudeSession,
  sendClaudeSession,
} from '../../agents/claude/drive/drive-session'
import {
  decideClaudePermission,
  readClaudePermission,
} from '../../agents/claude/drive/permission-session'
import {
  type ClaudeSessionStarter,
  startClaudeSession,
} from '../../agents/claude/drive/start-session'
import type { CodexSessionDriver } from '../../agents/codex/drive/codex-session-driver'
import { interruptCodexSession, sendCodexSession } from '../../agents/codex/drive/drive-session'
import { type CodexSessionStarter, startCodexSession } from '../../agents/codex/drive/start-session'
import { registerDomainHandlers } from '../contract/domain'
import {
  type SessionFeedReply,
  type SessionFeedRequest,
  type SessionListReply,
  type SessionListRequest,
  sessionError,
} from './contract'
import { SESSION_OPERATIONS } from './operations'

export type SessionReader = {
  listSessions(request: SessionListRequest): Promise<SessionListReply>
  readSessionFeed(request: SessionFeedRequest): Promise<SessionFeedReply>
}

type SessionContext = {
  driver: ClaudeSessionDriver
  codexDriver: CodexSessionDriver
  codexStarter: CodexSessionStarter
  reader: SessionReader
  starter: ClaudeSessionStarter
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
      startClaude: (request, context) => startClaudeSession(request, context.starter),
      sendClaude: (request, context) => sendClaudeSession(request, context.driver),
      interruptClaude: (request, context) => interruptClaudeSession(request, context.driver),
      compactClaude: (request, context) => compactClaudeSession(request, context.driver),
      readClaudePermission: (request, context) => readClaudePermission(request, context.driver),
      decideClaudePermission: (request, context) => decideClaudePermission(request, context.driver),
      startCodex: (request, context) => startCodexSession(request, context.codexStarter),
      sendCodex: (request, context) => sendCodexSession(request, context.codexDriver),
      interruptCodex: (request, context) => interruptCodexSession(request, context.codexDriver),
    },
    error: sessionError,
  })
}
