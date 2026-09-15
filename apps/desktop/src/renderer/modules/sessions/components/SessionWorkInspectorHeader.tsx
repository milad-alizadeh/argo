import { useTranslation } from 'react-i18next'
import { delegationState, type SessionWork, spentTokens, workDuration } from './session-work'

// Work is always inspected one pane at a time, so its name and state belong in that pane's chrome.
export function SessionWorkInspectorHeader({ work, now }: { work: SessionWork; now?: number }) {
  const { t } = useTranslation('sessions')
  const currentTime = now ?? Date.now()
  if (work.kind === 'delegation') {
    const { delegation, tokens } = work
    return (
      <InspectorHeader
        facts={[
          t(`workState.${delegationState(delegation)}`),
          workDuration(delegation.startedAt, delegation.endedAt, currentTime),
          spentTokens(tokens, t),
        ]}
        title={delegation.label ?? delegation.id}
      />
    )
  }

  const { command } = work

  return (
    <InspectorHeader
      facts={[
        t(`workState.${command.state}`),
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
