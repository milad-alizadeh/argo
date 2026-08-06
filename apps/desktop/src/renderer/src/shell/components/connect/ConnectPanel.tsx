import type { Cli } from '@shared'
import { Button, Text } from '@/shared/components/ui'
import type { ConnectPanelModel, ConnectRowView } from '../../connect/connectPanelModel'
import { AgentPicker } from './AgentPicker'
import { ConnectRow } from './ConnectRow'
import { DeviceCode } from './DeviceCode'
import { GrantNotice } from './GrantNotice'
import { WelcomeScreen } from './WelcomeScreen'

/** Everything the panel raises, gathered so the container wires it once. */
export interface ConnectPanelHandlers {
  /** Leave Welcome for the Connect panel. */
  onContinue: () => void
  /** Run one row's act: pick a folder, or sign in to GitHub. */
  onRowAct: (key: ConnectRowView['key']) => void
  /** Choose the agent CLI this project spawns. Project Settings only. */
  onChooseCli: (cli: Cli) => void
  /** Create the project, or close the panel when it already exists. */
  onCommit: () => void
  /** Leave a refused grant unresolved and keep working on what Argo already has. */
  onContinueOffline: () => void
}

/**
 * Organism: onboarding and Project Settings, which are one surface.
 *
 * Onboarding IS creating a Project (ADR-0015), so this is the project-setup panel rather than a
 * gated wizard: three independent rows, completable in any order, and a folder is all that is
 * required. Git and a provider unlock the backlog and pull requests; they never gate entry.
 * Re-opened on an existing project it is Project Settings, which adds the Agent row and reads
 * `Done` — and it is the reconnect surface too, so no separate connections screen exists.
 */
export function ConnectPanel({
  panel,
  handlers,
}: {
  /** The derived panel: which state it is in, its rows, and its call to action. */
  panel: ConnectPanelModel
  handlers: ConnectPanelHandlers
}): React.JSX.Element {
  if (panel.state === 'welcome') return <WelcomeScreen onContinue={handlers.onContinue} />
  return (
    <div
      data-component="ConnectPanel"
      className="flex w-full max-w-prose flex-col gap-region px-region"
    >
      <div className="flex flex-col gap-gap">
        <Text variant="display" as="h1" className="text-foreground-bright">
          {panel.title}
        </Text>
        <Text variant="prose" as="p" className="text-foreground-soft">
          A folder is all Argo needs. Everything below can be done in any order, now or later.
        </Text>
      </div>

      {panel.state === 'error' && (
        <GrantNotice
          onReconnect={() => handlers.onRowAct('connections')}
          onContinueOffline={handlers.onContinueOffline}
        />
      )}
      {panel.device !== null && <DeviceCode prompt={panel.device} />}

      <div className="flex flex-col gap-gap">
        {panel.rows.map((row) => (
          <ConnectRow key={row.key} row={row} onAct={() => handlers.onRowAct(row.key)} />
        ))}
        {panel.cli !== null && <AgentPicker cli={panel.cli} onChoose={handlers.onChooseCli} />}
      </div>

      <div className="flex">
        <Button variant="primary" disabled={!panel.cta.enabled} onClick={handlers.onCommit}>
          {panel.cta.label}
        </Button>
      </div>
    </div>
  )
}
