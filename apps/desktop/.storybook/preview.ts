import type { Preview } from '@storybook/react'
import { createElement } from 'react'

import '../src/renderer/i18n/config'
import { SessionQueryProvider } from '../src/renderer/session-query-provider'
import '../src/renderer/styles/globals.css'

// The Feed keys its measure pass on the window's zoom, read off the preload bridge
// (`feed/measure.ts`). A story has no preload, so the one call it reaches is answered here with
// the zoom a story is drawn at.
const host = window as unknown as { argo?: Record<string, unknown> }
const storybookSession = {
  id: 'storybook-session',
  retiredIds: [],
  cli: 'claude',
  posture: 'external',
  title: { text: 'Storybook Session', source: 'first-prompt' },
  status: 'idle',
  entry: 'interactive',
  cwd: '/storybook/argo',
  branch: 'main',
  updatedAt: null,
  unreadableLines: 0,
  originUnread: false,
  turnStartedAt: null,
  activity: null,
  plan: null,
  delegations: [],
  shell: [],
  pullRequest: null,
  archived: false,
}
host.argo = {
  ...host.argo,
  getAppearance: () => Promise.resolve({ appearance: 'system', dark: true }),
  setAppearance: () => Promise.resolve({ appearance: 'system', dark: true }),
  onAppearanceChanged: () => () => {},
  onCommand: () => () => {},
  listSessions: () =>
    Promise.resolve({
      version: 1,
      type: 'session.listed',
      requestId: 'storybook-sessions',
      sessions: [storybookSession],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
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
  readClaudePermission: (request: { requestId: string; sessionId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'session.claude.permission.read',
      requestId: request.requestId,
      sessionId: request.sessionId,
      permission: null,
    }),
  listProjects: () =>
    Promise.resolve({
      version: 1,
      type: 'project.listed',
      requestId: 'storybook-projects',
      projects: [
        { id: 'storybook-project', name: 'argo', path: '/storybook/argo' },
        { id: 'storybook-worktree', name: 'worktree', path: '/storybook/worktree' },
      ],
      selectedId: 'storybook-project',
    }),
  openProject: () =>
    Promise.resolve({
      version: 1,
      type: 'project.opened',
      requestId: 'storybook-project',
      project: { id: 'storybook-project', name: 'argo' },
    }),
  registerProject: () =>
    Promise.resolve({
      version: 1,
      type: 'project.listed',
      requestId: 'storybook-projects',
      projects: [
        { id: 'storybook-project', name: 'argo', path: '/storybook/argo' },
        { id: 'storybook-worktree', name: 'worktree', path: '/storybook/worktree' },
      ],
      selectedId: 'storybook-project',
    }),
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
      return createElement(SessionQueryProvider, null, Story())
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
