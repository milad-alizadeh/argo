import type { BrowserWindow } from 'electron'
import { requestIdentifier } from '../boundary'
import { SESSION_FEED_CHANNEL, SESSION_LIST_CHANNEL, sessionError } from './contract'
import { listSessions, readFeed } from './read-sessions'

// The same renderer authority the Project bridge asserts: the main frame of this window, on the
// renderer URL this app loaded. A page that navigated away holds no Session.
export function attachSessionBridge(
  window: BrowserWindow,
  storage: { transcriptsRoot: string; rendererURL: string },
): void {
  const answer = (channel: string, read: (request: unknown, root: string) => Promise<unknown>) => {
    window.webContents.ipc.handle(channel, (event, request: unknown) => {
      if (
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame?.url !== storage.rendererURL
      ) {
        return sessionError('access-denied', requestIdentifier(request))
      }
      return read(request, storage.transcriptsRoot)
    })
  }
  answer(SESSION_LIST_CHANNEL, listSessions)
  answer(SESSION_FEED_CHANNEL, readFeed)
}
