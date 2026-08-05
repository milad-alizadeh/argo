import { Tabs } from '@/shared/components/ui'
import { EXTERNAL, FRESH } from '../__fixtures__/interior'
import { Dock } from '../components/Dock'
import { Roster } from '../components/Roster'
import { SessionHeader } from '../components/SessionHeader'
import { buildSessionsRoomModel } from '../sessionsRoomModel'
import { isDockExpanded, SPINE } from '../useSpineLayout'
import { LONG_INTERIOR, LONG_SESSION } from './longSession'

// PROTOTYPE. The host page, so every variant is judged against the real thing beside it — real
// roster, real header band, real Dock, real glass. A variant judged on an empty route always looks
// fine; the question here is whether it survives the density it actually ships into.

const ROSTER = buildSessionsRoomModel({
  sessions: [LONG_SESSION, FRESH, EXTERNAL],
  selectedId: LONG_SESSION.id,
})

const GLASS_PLANE = 'plane flex min-w-0 flex-1 flex-col overflow-hidden'

const noop = (): void => {}

/** The session plane with the Activity tab's body swapped for a variant. The tab strip is dropped:
 * Delivery is not what any of this is about, and a second empty tab is one more thing on screen. */
export function PrototypeShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <main
      style={{
        '--c-rail': `${SPINE.roster.initial}px`,
        '--c-act': '50%',
        '--r-dock': `${SPINE.dock.initial}px`,
      }}
      className="flex min-h-0 min-w-0 flex-1 p-inset text-foreground"
    >
      <Roster model={ROSTER} onSelectSession={noop} onSpawnSession={noop} />
      <div className="w-inset shrink-0" />
      {/* The header's tab strip needs a `Tabs` root above it, exactly as `SessionPlane` mounts one. */}
      <Tabs value="activity" className={GLASS_PLANE}>
        <SessionHeader header={LONG_INTERIOR.header} />
        <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
        <Dock dock={LONG_INTERIOR.dock} expanded={isDockExpanded(SPINE.dock.initial)} />
      </Tabs>
    </main>
  )
}
