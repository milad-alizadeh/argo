import { useTranslation } from 'react-i18next'
import {
  elapsedDuration,
  type SessionWork,
  subagentWorkState,
} from '@/domains/sessions/renderer/work/session-work'
import { workPresentation } from '@/domains/sessions/renderer/work/work-presentation'

// Work is always inspected one pane at a time, so its name and state belong in that pane's chrome.
export function SessionWorkInspectorHeader({ work, now }: { work: SessionWork; now?: number }) {
  const { t } = useTranslation('sessions')
  const currentTime = now ?? Date.now()
  if (work.kind === 'delegation') {
    const { delegation, usage } = work
    const presentation = workPresentation(
      {
        kind: 'subagent',
        id: delegation.id,
        name: delegation.label,
        state: subagentWorkState(delegation),
        model: usage.model ?? null,
        durationMs: elapsedDuration(delegation.startedAt, delegation.endedAt, currentTime),
        tokens: usage.tokens ?? null,
      },
      t,
    )
    return (
      <InspectorHeader
        facts={[presentation.state, presentation.facts]}
        title={presentation.title}
      />
    )
  }

  const { command } = work
  const presentation = workPresentation({ kind: 'shell', ...command, now: currentTime }, t)

  return (
    <InspectorHeader
      facts={[presentation.state, presentation.facts]}
      monospace={command.label === null}
      title={presentation.title}
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
