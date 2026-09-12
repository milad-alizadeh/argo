import type { Session, SessionFeed as SessionFeedData, SessionId } from '../types'
import { Composer, type ComposerContent } from './Composer'
import { ComposerDock } from './ComposerDock'
import { ComposerUnavailable, deriveComposerAvailability } from './ComposerUnavailable'
import { SessionDeckHead } from './SessionDeckHead'
import { SessionFeed } from './SessionFeed'

export function SessionWorkspace({
  selected,
  selectedSessionId,
  feed,
  feedFailure,
  loading,
  noSessions,
  onReread,
  inspectorAvailable,
  inspectorOpen,
  onShowInspector,
  onShowRoster,
  composerContent,
}: {
  selected: Session | null
  selectedSessionId: SessionId | null
  feed: SessionFeedData | null
  feedFailure: string | null
  loading: boolean
  noSessions: boolean
  onReread: () => void
  inspectorAvailable: boolean
  inspectorOpen: boolean
  onShowInspector: () => void
  onShowRoster: () => void
  composerContent?: ComposerContent
}) {
  const availability = deriveComposerAvailability(selected)
  return (
    <div className="session-page__workspace" data-component="SessionWorkspace">
      <SessionDeckHead
        onShowInspector={onShowInspector}
        onShowRoster={onShowRoster}
        session={selected}
        showInspectorToggle={inspectorAvailable && !inspectorOpen}
      />
      <SessionFeed
        emptyReason={noSessions ? 'no-sessions' : null}
        failure={feedFailure}
        feed={feed}
        loading={loading}
        onReread={onReread}
        sessionId={selectedSessionId}
        selected={selectedSessionId !== null}
      />
      {selected === null ? null : (
        <ComposerDock>
          {availability === null ? (
            <Composer content={composerContent} session={selected} />
          ) : (
            <ComposerUnavailable availability={availability} />
          )}
        </ComposerDock>
      )}
    </div>
  )
}
