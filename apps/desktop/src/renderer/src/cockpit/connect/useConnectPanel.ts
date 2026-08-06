import type { DeviceCodePrompt } from '@shared'
import { useCallback, useState } from 'react'
import {
  buildConnectPanelModel,
  type ConnectMode,
  type ConnectPanelHandlers,
  type ConnectPanelModel,
} from '@/shell/components'
import { useSessionStore } from '../projection/sessionStore'
import { connectActs } from './connectActs'

// The connect panel's wiring. Only two things here are not on the projection: which entry
// opened the panel, and a folder chosen but not yet created from — a Project that does not
// exist yet has nowhere else to keep it.

export interface ConnectPanel {
  /** The derived panel, or `null` when nothing is open. */
  panel: ConnectPanelModel | null
  handlers: ConnectPanelHandlers
  /** Open onboarding: Welcome first, then the Connect panel. */
  startOnboarding: () => void
  /** Open Project Settings on a project that already exists. */
  openSettings: (projectId: string) => void
}

interface Opened {
  mode: ConnectMode
  welcoming: boolean
  /** Which project's settings are open. `null` while onboarding, which has none yet. */
  projectId: string | null
  folder: string | null
}

export function useConnectPanel(): ConnectPanel {
  const projects = useSessionStore((state) => state.projects)
  const grant = useSessionStore((state) => state.grant)
  const [opened, setOpened] = useState<Opened | null>(null)
  const [device, setDevice] = useState<DeviceCodePrompt | null>(null)

  const amend = useCallback(
    (change: Partial<Opened>) =>
      setOpened((state) => (state === null ? state : { ...state, ...change })),
    [],
  )
  const close = useCallback(() => {
    setOpened(null)
    setDevice(null)
  }, [])

  const project = projects.find((candidate) => candidate.id === opened?.projectId) ?? null
  return {
    panel: opened === null ? null : model(opened, { project, grant, device }),
    handlers: connectActs({
      opened: opened ?? { mode: 'onboarding', projectId: null, folder: null },
      setFolder: (folder) => amend({ folder }),
      setWelcoming: (welcoming) => amend({ welcoming }),
      setDevice,
      close,
    }),
    startOnboarding: () =>
      setOpened({ mode: 'onboarding', welcoming: true, projectId: null, folder: null }),
    openSettings: (projectId) =>
      setOpened({ mode: 'settings', welcoming: false, projectId, folder: null }),
  }
}

/** What the panel reads off the projection, beside the folder the user just picked. */
interface PanelContext {
  project: { path: string; cli: ConnectPanelModel['cli'] } | null
  grant: Parameters<typeof buildConnectPanelModel>[0]['grant']
  device: DeviceCodePrompt | null
}

function model(opened: Opened, context: PanelContext): ConnectPanelModel {
  return buildConnectPanelModel({
    mode: opened.mode,
    welcoming: opened.welcoming,
    // The folder being onboarded, or the one the Project was registered on. Only onboarding
    // can pick one, so these two never compete for the same panel.
    folder: opened.folder ?? context.project?.path ?? null,
    grant: context.grant,
    // Argo bundles no companion plugin to install yet, so the row is honestly unavailable
    // rather than a button that would do nothing.
    plugin: 'unavailable',
    device: context.device,
    cli: context.project?.cli ?? null,
  })
}
