import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../../components/ui/resizable'

import { AgentsRail } from '../components/AgentsRail'
import { SessionDeckHead } from '../components/SessionDeckHead'
import { SessionFeed } from '../components/SessionFeed'
import { SessionRoster } from '../components/SessionRoster'
import type { Session, SessionFeed as SessionFeedData, SessionId } from '../types'

type SessionsScreenViewProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  feed: SessionFeedData | null
  /** The last Roster pass's failure, if it had one. The rows on screen are the older pass's. */
  failure: string | null
  /** Why the selected Session's history could not be read, when it could not. */
  feedFailure: string | null
  onSelect: (sessionId: SessionId) => void
  onReread: () => void
}

// The Roster's width in pixels, from the approved layout (`roster-row-signals-prototype.html` ·
// ArgoLayout `sidebar-w`). A drag moves it between the two bounds. The pane keeps its pixel width
// when the window changes size, so a wider window widens the Feed and not the list of Sessions.
const ROSTER = { defaultSize: 320, minSize: 240, maxSize: 480 }
// The Agents rail's width, from the same layout (`deck-body`'s first column). Its chips are one
// line each, so it can go narrower than the Roster before a label stops saying anything.
const RAIL = { defaultSize: 220, minSize: 160, maxSize: 360 }
// Narrower than this and a Feed row is a column of single words.
const FEED_MIN = 320

export function SessionsScreenView({
  sessions,
  selectedSessionId,
  feed,
  failure,
  feedFailure,
  onSelect,
  onReread,
}: SessionsScreenViewProps) {
  const selected = sessions.find((session) => session.id === selectedSessionId) ?? null
  // The rail is for the work running under the selected Session, so a Session running none of it
  // gives its whole deck body to the Feed rather than keeping an empty column beside it.
  const working =
    selected !== null && (selected.delegations.length > 0 || selected.shell.length > 0)

  return (
    // The Roster and the Feed are two panes with a drag handle between them, and each one owns its
    // own scrolling: the height comes from the surface this screen is given rather than from the
    // viewport, so the deck around it never scrolls the pair as one document. A `h-dvh` here
    // would measure the window instead and stand taller than the space it was given. A drag is
    // the case ADR-0033 rule 6 is written for: the Feed stays at its settled width, clipped, and
    // measures once the width stops moving.
    <main className="h-full min-h-0 bg-background">
      <ResizablePanelGroup id="sessions" orientation="horizontal">
        <ResizablePanel groupResizeBehavior="preserve-pixel-size" id="roster" {...ROSTER}>
          <SessionRoster
            failure={failure}
            onReread={onReread}
            onSelect={onSelect}
            selectedSessionId={selectedSessionId}
            sessions={sessions}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="deck" minSize={RAIL.minSize + FEED_MIN}>
          <div className="flex h-full min-h-0 flex-col">
            <SessionDeckHead session={selected} />
            {/* The deck body: the Agents rail and the Feed, a second pair with its own handle,
                so a reader who wants the Feed wider can take it from the rail and not only from
                the Roster. */}
            <div className="min-h-0 flex-1">
              <ResizablePanelGroup id="deck-body" orientation="horizontal">
                {working ? (
                  <>
                    <ResizablePanel groupResizeBehavior="preserve-pixel-size" id="agents" {...RAIL}>
                      <AgentsRail session={selected} />
                    </ResizablePanel>
                    <ResizableHandle />
                  </>
                ) : null}
                <ResizablePanel id="feed" minSize={FEED_MIN}>
                  <SessionFeed
                    failure={feedFailure}
                    feed={feed}
                    selected={selectedSessionId !== null}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
