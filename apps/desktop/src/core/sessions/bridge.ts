import type { BrowserWindow } from 'electron'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import { requestIdentifier } from '../../boundary'
import { SESSION_FEED_CHANNEL, SESSION_LIST_CHANNEL, sessionError } from './contract'

export type SessionReader = {
  listSessions(request: unknown): Promise<unknown>
  readSessionFeed(request: unknown): Promise<unknown>
}

// The same renderer authority the Project bridge asserts: the main frame of this window, on the
// renderer URL this app loaded. A page that navigated away holds no Session.
export function attachSessionBridge(
  window: BrowserWindow,
  storage: { reader: SessionReader; rendererURL: string },
): void {
  const answer = (channel: string, read: (request: unknown) => Promise<unknown>) => {
    window.webContents.ipc.handle(channel, (event, request: unknown) => {
      if (!isTrustedRendererFrame(event, window, storage.rendererURL)) {
        return sessionError('access-denied', requestIdentifier(request))
      }
      return read(request)
    })
  }
  answer(SESSION_LIST_CHANNEL, storage.reader.listSessions)
  answer(SESSION_FEED_CHANNEL, storage.reader.readSessionFeed)
}
