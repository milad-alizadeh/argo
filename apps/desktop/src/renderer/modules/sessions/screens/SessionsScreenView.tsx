import type { ReactNode } from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../../components/ui/resizable'

import { AgentsRail } from '../components/AgentsRail'
import { ComposerUnavailable, deriveComposerAvailability } from '../components/ComposerUnavailable'
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
  projectHeader?: ReactNode
}

// The Roster's width in pixels, from the approved layout (`roster-row-signals-prototype.html` ·
// ArgoLayout `sidebar-w`). A drag moves it between the two bounds. The pane keeps its pixel width
// when the window changes size, so a wider window widens the Feed and not the list of Sessions.
const ROSTER = { defaultSize: 320, minSize: 240, maxSize: 480 }
// The inspector's width, from the same layout. Its chips are one line each, so it can go narrower
// than the Roster before a label stops saying anything.
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
  projectHeader,
}: SessionsScreenViewProps) {
  const selected = sessions.find((session) => session.id === selectedSessionId) ?? null
  // The rail is for the work running under the selected Session, so a Session running none of it
  // gives its whole deck body to the Feed rather than keeping an empty column beside it.
  const working =
    selected !== null && (selected.delegations.length > 0 || selected.shell.length > 0)
  const composerAvailability = deriveComposerAvailability(selected)

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
          <div className="flex h-full min-h-0 flex-col">
            {projectHeader}
            <SessionRoster
              failure={failure}
              onReread={onReread}
              onSelect={onSelect}
              selectedSessionId={selectedSessionId}
              sessions={sessions}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="deck" minSize={FEED_MIN}>
          <ResizablePanelGroup id="session-workspace" orientation="horizontal">
            <ResizablePanel id="feed" minSize={FEED_MIN}>
              <div className="flex h-full min-h-0 flex-col">
                <SessionDeckHead session={selected} />
                <div className="min-h-0 flex-1">
                  <SessionFeed
                    failure={feedFailure}
                    feed={feed}
                    sessionId={selectedSessionId}
                    selected={selectedSessionId !== null}
                  />
                </div>
                {composerAvailability === null ? null : (
                  <ComposerUnavailable availability={composerAvailability} />
                )}
              </div>
            </ResizablePanel>
            {working ? (
              <>
                <ResizableHandle />
                <ResizablePanel
                  groupResizeBehavior="preserve-pixel-size"
                  id="session-inspector"
                  {...RAIL}
                >
                  <AgentsRail session={selected} />
                </ResizablePanel>
              </>
            ) : null}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
