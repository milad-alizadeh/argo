import { useTranslation } from 'react-i18next'
import {
  delegationState,
  readableDelegationName,
  type SessionWork,
  spentTokens,
  workDuration,
} from '@/domains/sessions/renderer/components/work/session-work'

// Work is always inspected one pane at a time, so its name and state belong in that pane's chrome.
export function SessionWorkInspectorHeader({ work, now }: { work: SessionWork; now?: number }) {
  const { t } = useTranslation('sessions')
  const currentTime = now ?? Date.now()
  if (work.kind === 'delegation') {
    const { delegation, usage } = work
    return (
      <InspectorHeader
        facts={[
          t(`workState.${delegationState(delegation)}`),
          workDuration(delegation.startedAt, delegation.endedAt, currentTime),
          spentTokens(usage.tokens, t),
        ]}
        title={delegation.label === null ? delegation.id : readableDelegationName(delegation.label)}
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
      monospace={command.label === null}
      title={command.label ?? command.command ?? command.id}
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
