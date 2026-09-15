import type { SessionDelegation, SessionShellCommand } from '@/core/sessions/models'
import { compactTokens, SHELL_STATE_WORDS, workDuration } from './session-work'

type SessionWorkInspectorHeaderProps =
  | {
      work: { kind: 'delegation'; delegation: SessionDelegation }
      now?: number
      tokens?: number | null
    }
  | { work: { kind: 'shell'; command: SessionShellCommand }; now?: number }

// Work is always inspected one pane at a time, so its name and state belong in that pane's chrome.
export function SessionWorkInspectorHeader({
  work,
  now,
  ...rest
}: SessionWorkInspectorHeaderProps) {
  const currentTime = now ?? Date.now()
  if (work.kind === 'delegation') {
    const { delegation } = work
    const tokens = 'tokens' in rest ? (rest.tokens ?? null) : null
    const compact = compactTokens(tokens)
    return (
      <InspectorHeader
        facts={[
          delegation.landed ? 'Done' : 'Running',
          workDuration(delegation.startedAt, delegation.endedAt, currentTime),
          compact === null ? null : `${compact} tokens`,
        ]}
        title={delegation.label ?? delegation.id}
      />
    )
  }

  const { command } = work

  return (
    <InspectorHeader
      facts={[
        SHELL_STATE_WORDS[command.state],
        workDuration(command.startedAt, command.endedAt, currentTime),
        command.result,
      ]}
      monospace
      title={command.command ?? command.id}
    />
  )
}

function InspectorHeader({
  facts,
  monospace = false,
  title,
}: {
  facts: (string | null)[]
  monospace?: boolean
  title: string
}) {
  return (
    <div className="min-w-0 flex-1 pr-(--inset-session-inspector-toggle)">
      <p
        className={
          monospace
            ? 'truncate font-mono type-meta text-foreground'
            : 'truncate type-meta text-foreground'
        }
      >
        {title}
      </p>
      <p className="truncate type-meta text-muted-foreground">
        {facts.filter((fact) => fact !== null).join(' · ')}
      </p>
    </div>
  )
}
