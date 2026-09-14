// The work rail: every Subagent and every background Shell one Session has, with the Feed each
// row opens (#1582). The Session's own Feed is the first row, so a reader who opened a Subagent
// always has the way back in the same list rather than in a control somewhere else.
import { CircleCheck } from 'lucide-react'
import type { SessionDelegation, SessionShellCommand, ShellState } from '@/core/sessions/models'
import { CollapsibleText } from '@/renderer/components/CollapsibleText'
import { Facts, WorkRow } from './SessionWorkRow'
import { compactTokens, SHELL_STATE_WORDS, workDuration } from './session-work'

// The same semantic marks the Roster draws a Session's status with.
const SHELL_MARKS: Record<ShellState, string> = {
  running: 'border border-active shadow-state-glow',
  completed: 'bg-idle',
  failed: 'bg-danger',
  killed: 'bg-warn',
  stopped: 'bg-warn',
}

export type SessionWorkInspectorProps = {
  delegations: readonly SessionDelegation[]
  shell: readonly SessionShellCommand[]
  // What each Subagent spent, keyed by the call that spawned it. A Subagent whose transcript has
  // not been read yet is simply absent, and its row then shows no token figure at all.
  delegationTokens?: Readonly<Record<string, number | null>>
  selectedDelegationId: string | null
  onSelectDelegation: (delegationId: string | null) => void
  selectedShellId: string | null
  onSelectShell: (shellId: string) => void
  // The clock a running row is measured against. Passed in so a story draws a fixed duration.
  now?: number
}

function DelegationRows({
  delegations,
  delegationTokens,
  now,
  selectedDelegationId,
  onSelectDelegation,
}: Pick<
  SessionWorkInspectorProps,
  'delegations' | 'delegationTokens' | 'now' | 'selectedDelegationId' | 'onSelectDelegation'
>) {
  return (
    <>
      <h2 className="mb-2 type-heading font-semibold text-foreground">
        Background Agents · {delegations.length}
      </h2>
      <div className="space-y-1">
        <WorkRow
          mark="bg-idle"
          markLabel="Session feed"
          selected={selectedDelegationId === null}
          onSelect={() => onSelectDelegation(null)}
        >
          <span className="min-w-0 flex-1 truncate">Main</span>
        </WorkRow>
        {delegations.map((delegation) => (
          <WorkRow
            key={delegation.id}
            mark={delegation.landed ? 'bg-idle' : 'bg-active shadow-state-glow'}
            markLabel={delegation.landed ? 'Landed' : 'Running'}
            selected={selectedDelegationId === delegation.id}
            onSelect={() => onSelectDelegation(delegation.id)}
          >
            <span className="min-w-0 flex-1 truncate">{delegation.label ?? delegation.id}</span>
            <Facts
              duration={workDuration(delegation.startedAt, delegation.endedAt, now ?? Date.now())}
              tokens={compactTokens(delegationTokens?.[delegation.id] ?? null)}
            />
          </WorkRow>
        ))}
      </div>
    </>
  )
}

function ShellRow({
  command,
  now,
  selectedShellId,
  onSelectShell,
}: { command: SessionShellCommand } & Pick<
  SessionWorkInspectorProps,
  'now' | 'selectedShellId' | 'onSelectShell'
>) {
  return (
    <WorkRow
      mark={SHELL_MARKS[command.state]}
      markLabel={SHELL_STATE_WORDS[command.state]}
      selected={selectedShellId === command.id}
      onSelect={() => onSelectShell(command.id)}
    >
      <span className="min-w-0 flex-1 truncate font-mono">{command.command ?? command.id}</span>
      <Facts
        duration={workDuration(command.startedAt, command.endedAt, now ?? Date.now())}
        tokens={null}
      />
    </WorkRow>
  )
}

// Finished commands fold away behind their own count: a long Session ends with more of them than
// a rail can hold, and what a reader is watching is the one still going.
function ShellRows({
  shell,
  now,
  selectedShellId,
  onSelectShell,
}: Pick<SessionWorkInspectorProps, 'shell' | 'now' | 'selectedShellId' | 'onSelectShell'>) {
  const running = shell.filter((command) => command.state === 'running')
  const finished = shell.filter((command) => command.state !== 'running')
  const rowOf = (command: SessionShellCommand) => (
    <ShellRow
      key={command.id}
      command={command}
      now={now}
      selectedShellId={selectedShellId}
      onSelectShell={onSelectShell}
    />
  )
  return (
    <>
      <h2 className="mb-2 type-heading font-semibold text-foreground">Shell · {shell.length}</h2>
      <div className="space-y-1">{running.map(rowOf)}</div>
      {finished.length > 0 ? (
        <div className="mt-3">
          <CollapsibleText
            content={<div className="space-y-1">{finished.map(rowOf)}</div>}
            contentVariant="plain"
            defaultOpen={finished.some((command) => command.id === selectedShellId)}
            icon={CircleCheck}
            title={`${finished.length} finished`}
          />
        </div>
      ) : null}
    </>
  )
}

export function SessionWorkInspector({
  delegations,
  shell,
  delegationTokens,
  selectedDelegationId,
  onSelectDelegation,
  selectedShellId,
  onSelectShell,
  now,
}: SessionWorkInspectorProps) {
  if (delegations.length === 0 && shell.length === 0) return null
  return (
    <section aria-label="Session work" className="min-h-0 flex-1 overflow-y-auto p-3">
      {delegations.length > 0 ? (
        <DelegationRows
          delegations={delegations}
          delegationTokens={delegationTokens}
          now={now}
          selectedDelegationId={selectedDelegationId}
          onSelectDelegation={onSelectDelegation}
        />
      ) : null}
      {delegations.length > 0 && shell.length > 0 ? (
        <div className="my-3 h-px bg-border/60" />
      ) : null}
      {shell.length > 0 ? (
        <ShellRows
          shell={shell}
          now={now}
          selectedShellId={selectedShellId}
          onSelectShell={onSelectShell}
        />
      ) : null}
    </section>
  )
}
