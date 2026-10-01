import { sessionRow } from '@/mocks/sessions/session-rows'
import { storybookAutoCompactProcedures } from './storybook-auto-compact'
import { subscribeToStorybookCommands } from './storybook-commands'
import { storybookHarnessSignInProcedures } from './storybook-harness-signin'
import { storybookProjectProcedures } from './storybook-projects'
import { createStorybookTrpcHost, type StorybookProcedureHandlers } from './storybook-trpc'
import { ticketsHost } from './tickets-host'

// The Feed keys its measure pass on the window's zoom, read off the preload bridge
// (`feed/measure.ts`). A story has no preload, so the one call it reaches is answered here with
// the zoom a story is drawn at.
export const host = window
const storybookSession = sessionRow({
  id: 'storybook-session',
  posture: null,
  name: 'Storybook Session',
  status: 'idle',
  cwd: '/storybook/argo',
})
const procedureHandlers = (): StorybookProcedureHandlers => {
  return {
    ...storybookProjectProcedures,
    ...storybookHarnessSignInProcedures,
    ...storybookAutoCompactProcedures,
    accountList: ticketsHost.accountList,
    composerCommands: () => ({ availability: 'pending', commands: [] }),
    ticketConnection: (input: { projectId: string }) => ({
      version: 1,
      type: 'ticket.connected',
      requestId: 'story',
      projectId: input.projectId,
      connection: null,
    }),
    'sessions.list': (input: { page: number; pageSize: number }) => ({
      page: input.page,
      pageSize: input.pageSize,
      total: 1,
      rows: input.page === 1 ? [storybookSession] : [],
    }),
  }
}
host.argo = {
  ...host.argo,
  getAppearance: () =>
    Promise.resolve({ theme: 'neutral', appearance: 'system', dark: true, revision: 0 }),
  setAppearance: () =>
    Promise.resolve({
      ok: true,
      state: { theme: 'neutral', appearance: 'system', dark: true, revision: 0 },
    }),
  appearanceReady: () =>
    Promise.resolve({
      ready: true,
      state: { theme: 'neutral', appearance: 'system', dark: true, revision: 0 },
    }),
  onAppearanceChanged: () => () => {},
  onCommand: subscribeToStorybookCommands,
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
  readConnection: ticketsHost.readConnection,
  trpc: createStorybookTrpcHost(procedureHandlers),
  trpcSubscribe: () => Promise.reject(new Error('Storybook has no tRPC subscriptions.')),
  zoomFactor: () => 1,
} as typeof host.argo
