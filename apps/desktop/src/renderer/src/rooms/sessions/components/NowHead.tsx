import { Text } from '@/shared/components/ui'
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
 *
 * No status dot. The header band above already leads with one, and two dots in one plane make a
 * reader hunt for which of them moved. Liveness here is carried the way the whole scene carries
 * attention — by BRIGHTNESS: the now-line burns at full ink while something is running and settles
 * back a step once it stops.
 */
export function NowHead({ now }: { now: NowHeadModel }): React.JSX.Element {
  return (
    <div data-component="NowHead" className="flex min-w-0 flex-1 items-center gap-snug">
      <Text
        variant="meta"
        className={`min-w-0 truncate ${now.live ? 'text-foreground' : 'text-foreground-soft'}`}
      >
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
