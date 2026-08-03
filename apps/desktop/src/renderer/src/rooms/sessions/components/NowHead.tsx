import { StatusDot, Text } from '@/shared/components/ui'
import type { NowHeadModel } from '../interiorDock'

function headline(now: NowHeadModel): string {
  if (now.task !== null) return now.task
  if (now.last !== null) return `idle · last: ${now.last}`
  return 'ready — type to begin'
}

/**
 * Molecule: what the session is doing right now, plus its plan `N/M`.
 *
 * It lives IN the Dock's header row rather than on a line of its own: live-process state is the
 * Dock's, and putting it there is what keeps it visible from both tabs without spending a second
 * strip. A session that has done nothing yet says so plainly instead of showing an empty task.
 */
export function NowHead({ now }: { now: NowHeadModel }): React.JSX.Element {
  return (
    <div data-component="NowHead" className="flex min-w-0 flex-1 items-center gap-snug">
      <StatusDot
        tone={now.live ? 'run' : 'gray'}
        glow={now.live ? 'live' : 'faint'}
        pulse={now.live}
      />
      <Text variant="meta" className="min-w-0 truncate text-foreground">
        {headline(now)}
      </Text>
      {now.plan && (
        <Text variant="code-inline" className="shrink-0 text-primary">
          {`plan ${now.plan.done}/${now.plan.total}`}
        </Text>
      )}
    </div>
  )
}
