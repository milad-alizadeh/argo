import type { Preview } from '@storybook/react-vite'
import { createElement } from 'react'

import { DEFAULT_AUTO_COMPACT_LIMIT } from '../src/agents/codex/compaction/compaction'
import '../src/renderer/i18n/config'
import { AppQueryProvider } from '../src/renderer/app-query-provider'
import { sessionRosterRow } from '../src/renderer/modules/sessions/session-fixtures'
import '../src/renderer/styles/globals.css'
import { subscribeToStorybookCommands } from './storybook-commands'
import { storybookProjectBridge } from './storybook-projects'
import { ticketsHost } from './tickets-host'

// The Feed keys its measure pass on the window's zoom, read off the preload bridge
// (`feed/measure.ts`). A story has no preload, so the one call it reaches is answered here with
// the zoom a story is drawn at.
const host = window
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
    }),
  ...storybookProjectBridge,
  ...ticketsHost,
  zoomFactor: () => 1,
}

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const dark = context.globals.theme === 'dark'
      host.argo = {
        ...host.argo,
        getAppearance: () => Promise.resolve({ appearance: dark ? 'dark' : 'light', dark }),
      }
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      return createElement(AppQueryProvider, null, Story())
    },
  ],
  globalTypes: {
    theme: {
      defaultValue: 'dark',
      description: 'Cockpit appearance',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    viewport: {
      options: {
        desktop: {
          name: 'Desktop 1200',
          styles: { width: '1200px', height: '800px' },
          type: 'desktop',
        },
        narrow: {
          name: 'Desktop 900',
          styles: { width: '900px', height: '800px' },
          type: 'desktop',
        },
        compact: {
          name: 'Desktop 680',
          styles: { width: '680px', height: '800px' },
          type: 'desktop',
        },
      },
    },
  },
}

export default preview
