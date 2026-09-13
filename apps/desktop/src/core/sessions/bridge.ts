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
import { SESSION_OPERATIONS, sessionError } from './contract'

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
  const handlers = {
    list: storage.reader.listSessions,
    feed: storage.reader.readSessionFeed,
    startClaude: (request: unknown) => startClaudeSession(request, storage.starter),
    sendClaude: (request: unknown) => driveClaudeSession(request, storage.driver),
    interruptClaude: (request: unknown) => driveClaudeSession(request, storage.driver),
    readClaudePermission: (request: unknown) => readClaudePermission(request, storage.driver),
    decideClaudePermission: (request: unknown) => decideClaudePermission(request, storage.driver),
  } satisfies Record<
    keyof typeof SESSION_OPERATIONS,
    (request: unknown) => Promise<unknown> | unknown
  >
  for (const operation of Object.keys(SESSION_OPERATIONS) as Array<
    keyof typeof SESSION_OPERATIONS
  >) {
    answer(SESSION_OPERATIONS[operation].channel, handlers[operation])
  }
}
