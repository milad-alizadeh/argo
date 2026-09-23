import { DEFAULT_AUTO_COMPACT_LIMIT } from '../src/domains/sessions/contract/codex-compaction'
import { sessionRosterRow } from '../src/domains/sessions/renderer/session-fixtures'
import { subscribeToStorybookCommands } from './storybook-commands'
import { storybookHarnessSignInBridge } from './storybook-harness-signin'
import { storybookProjectBridge } from './storybook-projects'
import { ticketsHost } from './tickets-host'

// The Feed keys its measure pass on the window's zoom, read off the preload bridge
// (`feed/measure.ts`). A story has no preload, so the one call it reaches is answered here with
// the zoom a story is drawn at.
export const host = window
let codexAutoCompactLimit = DEFAULT_AUTO_COMPACT_LIMIT
const storybookSession = sessionRosterRow({
  id: 'storybook-session',
  posture: 'external',
  title: { text: 'Storybook Session', source: 'first-prompt' },
  status: 'idle',
  cwd: '/storybook/argo',
})
host.argo = {
  ...host.argo,
  readCodexModelCatalog: () => Promise.resolve(null),
  readClaudeModelCatalog: () => Promise.resolve(null),
  getAppearance: () => Promise.resolve({ appearance: 'system', dark: true }),
  setAppearance: () => Promise.resolve({ appearance: 'system', dark: true }),
  onAppearanceChanged: () => () => {},
  getCodexAutoCompactLimit: () => Promise.resolve(codexAutoCompactLimit),
  setCodexAutoCompactLimit: (limit: number) => {
    codexAutoCompactLimit = limit
    return Promise.resolve(codexAutoCompactLimit)
  },
  onCommand: subscribeToStorybookCommands,
  // Nothing watches files in a story, so a reader that stops polling because a watch will tell it
  // subscribes to a watch that never reports. Every story needs the call to answer: a screen that
  // reads a watched topic mounts this hook whatever the story is about.
  onWatchedChanged: () => () => {},
  listSessions: () =>
    Promise.resolve({
      version: 1,
      type: 'session.listed',
      requestId: 'storybook-sessions',
      sessions: [storybookSession],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
      historyComplete: true,
      partialFailures: [],
    }),
  readSessionFeed: (request: { sessionId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'session.feed.read',
      requestId: 'storybook-feed',
      sessionId: request.sessionId,
      chainId: request.sessionId,
      revision: 'storybook-feed',
      rows: [
        { shape: 'prose', id: 'storybook-row', role: 'assistant', text: 'Storybook Session Feed.' },
      ],
    }),
  cancelSessionFeed: (request: { sessionId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'session.accepted',
      requestId: 'storybook-feed-cancel',
      sessionId: request.sessionId,
    }),
  focusSessionUnread: (request: { sessionId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'session.unread.focused',
      requestId: 'storybook-unread-focus',
      sessionId: request.sessionId,
    }),
  readSessionPermission: (request: { requestId: string; sessionId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'session.permission.read',
      requestId: request.requestId,
      sessionId: request.sessionId,
      permission: null,
    }),
  listArchivedSessions: () =>
    Promise.resolve({
      version: 1,
      type: 'session.archive.listed',
      requestId: 'storybook-archive',
      sessions: [],
      nextCursor: null,
      restored: null,
      historyComplete: true,
    }),
  ...storybookProjectBridge,
  ...ticketsHost,
  ...storybookHarnessSignInBridge,
  zoomFactor: () => 1,
}
