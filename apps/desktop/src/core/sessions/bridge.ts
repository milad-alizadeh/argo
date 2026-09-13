import type { BrowserWindow } from 'electron'
import type { ClaudeSessionDriver } from '../../agents/claude/drive/claude-session-driver'
import { driveClaudeSession } from '../../agents/claude/drive/drive-session'
import {
  decideClaudePermission,
  readClaudePermission,
} from '../../agents/claude/drive/permission-session'
import {
  type ClaudeSessionStarter,
  startClaudeSession,
} from '../../agents/claude/drive/start-session'
import { requestIdentifier } from '../../boundary'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import {
  SESSION_CLAUDE_INTERRUPT_CHANNEL,
  SESSION_CLAUDE_PERMISSION_CHANNEL,
  SESSION_CLAUDE_PERMISSION_DECIDE_CHANNEL,
  SESSION_CLAUDE_SEND_CHANNEL,
  SESSION_CLAUDE_START_CHANNEL,
  SESSION_FEED_CHANNEL,
  SESSION_LIST_CHANNEL,
  sessionError,
} from './contract'

export type SessionReader = {
  listSessions(request: unknown): Promise<unknown>
  readSessionFeed(request: unknown): Promise<unknown>
}

// The same renderer authority the Project bridge asserts: the main frame of this window, on the
// renderer URL this app loaded. A page that navigated away holds no Session.
export function attachSessionBridge(
  window: BrowserWindow,
  storage: {
    driver: ClaudeSessionDriver
    reader: SessionReader
    starter: ClaudeSessionStarter
    rendererURL: string
  },
): void {
  const answer = (channel: string, read: (request: unknown) => Promise<unknown> | unknown) => {
    window.webContents.ipc.handle(channel, (event, request: unknown) => {
      if (!isTrustedRendererFrame(event, window, storage.rendererURL)) {
        return sessionError('access-denied', requestIdentifier(request))
      }
      return read(request)
    })
  }
  answer(SESSION_LIST_CHANNEL, storage.reader.listSessions)
  answer(SESSION_FEED_CHANNEL, storage.reader.readSessionFeed)
  answer(SESSION_CLAUDE_START_CHANNEL, (request) => startClaudeSession(request, storage.starter))
  answer(SESSION_CLAUDE_SEND_CHANNEL, (request) => driveClaudeSession(request, storage.driver))
  answer(SESSION_CLAUDE_INTERRUPT_CHANNEL, (request) => driveClaudeSession(request, storage.driver))
  answer(SESSION_CLAUDE_PERMISSION_CHANNEL, (request) =>
    readClaudePermission(request, storage.driver),
  )
  answer(SESSION_CLAUDE_PERMISSION_DECIDE_CHANNEL, (request) =>
    decideClaudePermission(request, storage.driver),
  )
}
