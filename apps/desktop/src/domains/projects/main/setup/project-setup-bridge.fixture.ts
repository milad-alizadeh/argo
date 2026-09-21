import type { BrowserWindow } from 'electron'
import type { ProjectSetupCommandRequest } from '@/domains/projects/contract/contract'
import type { SetupPlan } from '@/domains/projects/contract/setup-plan'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { createProjectSetupBridge } from './project-setup-bridge'
import type { ProjectSetupEffects } from './project-setup-effects'
import type { ProjectSetupRecord } from './project-setup-registry'

export function projectSetupStore() {
  let record: ProjectSetupRecord | null = null
  return {
    read: () => ({
      projects: [{ id: 'project-1', path: '/repo', commonDirectory: '/repo/.git' }],
      selectedId: 'project-1',
    }),
    readProjectSetup: () => record,
    writeProjectSetup: (next: ProjectSetupRecord) => {
      record = next
    },
  }
}

export function projectSetupWindow() {
  return {
    once: () => undefined,
    webContents: { send: () => undefined },
  } as unknown as BrowserWindow
}

export function settleProjectSetup() {
  return new Promise((resolve) => setImmediate(() => setImmediate(resolve)))
}

export function projectSetupCommand(
  bridge: { command: (request: ProjectSetupCommandRequest) => unknown },
  command: unknown,
  revision: number,
) {
  return bridge.command({
    version: 1,
    type: 'project.setup.command',
    requestId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    projectId: 'project-1',
    expectedRevision: revision,
    command: command as ProjectSetupCommandRequest['command'],
  })
}

export const asProjectStore = (store: ReturnType<typeof projectSetupStore>) =>
  store as unknown as ProjectStore

export function projectSetupBridge(effects: ProjectSetupEffects) {
  return createProjectSetupBridge(
    projectSetupWindow(),
    asProjectStore(projectSetupStore()),
    effects,
  )
}

export function effectsForPlan(
  plan: SetupPlan,
  overrides: Partial<ProjectSetupEffects> = {},
): ProjectSetupEffects {
  return {
    preflight: async () => true,
    plan: async () => ({ kind: 'plan', plan }),
    apply: async ({ onStarted }) => {
      onStarted('application-session')
      return { finalDiff: 'diff --git a/.argo/settings.json b/.argo/settings.json' }
    },
    ...overrides,
  }
}
