import { useState } from 'react'
import { noteOnReading, type ReadingCounts } from '../sessions/reading-note'
import './tokens.css'
import './cockpit.css'
import { Feed } from './feed/Feed'
import { Roster } from './Roster'
import { useFeed, useRoster } from './useObservedSessions'

// The root window this slice mounts is deliberately small. #1828 owns Project registration and
// the shell's appearance and navigation; what is here is a Roster, a Feed and the sentence that
// says what was read, so the two slices reconcile at one file rather than across a screen.
export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { discovery, failure, reread } = useRoster()
  const { feed, failure: feedFailure } = useFeed(selectedId)
  // The Feed on hand is drawn only while it is the Feed for the chosen Session. Choosing another
  // renders this component with the new id before the effect that clears the rows has run, so for
  // one committed frame the previous Session's history is in hand under the new Session's name.
  // Comparing the two is what stops that frame reaching the screen.
  const shown = feed !== null && feed.sessionId === selectedId ? feed : null

  // A pass that failed replaces nothing. The reading on hand is older than the reader asked for
  // and the note says so, but a Roster and a Feed they can still read beat an error page whose
  // only way back — the button that asks for another pass — is on the page it replaced.
  if (discovery === null)
    return <Standing text={failure?.message ?? "Argo is reading this machine's Sessions."} />

  return (
    <main className="cockpit">
      <div className="cockpit__roster">
        <ReadingNote counts={discovery} failure={failure?.message ?? null} onReread={reread} />
        <Roster sessions={discovery.sessions} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <Feed
        sessionId={shown === null ? null : selectedId}
        rows={shown?.rows ?? []}
        standing={feedStanding(selectedId, feedFailure?.message ?? null)}
      />
    </main>
  )
}

function feedStanding(selectedId: string | null, failure: string | null): string {
  if (failure !== null) return failure
  if (selectedId === null) return 'Choose a Session to read its history.'
  return 'Argo has not read this Session yet.'
}

// Nothing watches the transcripts, so this reading is as old as the pass that made it, and the
// reader is given the way to take another rather than left to guess whether it moved. A pass that
// failed is said here too: the note is where the age of this reading is already written.
function ReadingNote({
  counts,
  failure,
  onReread,
}: {
  counts: ReadingCounts
  failure: string | null
  onReread: () => void
}) {
  return (
    <p className="cockpit__note">
      {noteOnReading(counts)} Every fact here is read from files Argo does not own.{' '}
      <button type="button" className="cockpit__reread" onClick={onReread}>
        Read again
      </button>
      {failure === null ? null : <span className="cockpit__failed">{failure}</span>}
    </p>
  )
}

function Standing({ text }: { text: string }) {
  return (
    <main className="cockpit cockpit--standing">
      <p>{text}</p>
    </main>
  )
}
