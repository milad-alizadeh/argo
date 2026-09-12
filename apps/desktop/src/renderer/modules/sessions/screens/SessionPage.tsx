import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../../components/ui/resizable'
import type { ComposerContent } from '../components/Composer'
import { SessionInspector } from '../components/SessionInspector'
import { SessionRoster } from '../components/SessionRoster'
import { SessionWorkspace } from '../components/SessionWorkspace'
import type { Session, SessionFeed as SessionFeedData, SessionId } from '../types'
import {
  inspectorState,
  rosterState,
  sessionPageState,
  useSessionPanels,
} from './session-page-state'
import './session-page.css'

type SessionPageProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  feed: SessionFeedData | null
  failure: string | null
  feedFailure: string | null
  loading: boolean
  onSelect: (sessionId: SessionId) => void
  onReread: () => void
  projectName: string
  composerContent?: ComposerContent
}

const ROSTER = { defaultSize: 336, minSize: 336, maxSize: 460 }
const FEED_MIN = 360

export function SessionPage(props: SessionPageProps) {
  const { sessions, selectedSessionId, feed, failure, feedFailure, loading } = props
  const selected = sessions.find((session) => session.id === selectedSessionId) ?? null
  const panels = useSessionPanels(selected)
  const choose = (sessionId: SessionId) => {
    props.onSelect(sessionId)
    if (panels.narrowRoster) panels.setRosterOpen(false)
  }
  const roster = sessionRoster(props, choose, () => panels.setRosterOpen(false))

  return (
    <main
      className="session-page"
      data-component="SessionPage"
      data-inspector={inspectorState(panels.inspectorAvailable, panels.inspectorVisible)}
      data-roster={rosterState(panels.narrowRoster, panels.rosterOpen)}
      data-state={
        panels.narrowRoster && panels.rosterOpen
          ? 'roster-open'
          : sessionPageState({
              selected,
              feed,
              failure,
              feedFailure,
              loading,
              sessionCount: sessions.length,
            })
      }
    >
      <ResizablePanelGroup className="session-page__panes" id="sessions" orientation="horizontal">
        {panels.rosterOpen ? (
          <>
            <ResizablePanel groupResizeBehavior="preserve-pixel-size" id="roster" {...ROSTER}>
              {roster}
            </ResizablePanel>
            <ResizableHandle />
          </>
        ) : null}
        <ResizablePanel id="deck" minSize={FEED_MIN}>
          <div className="session-page__deck">
            <SessionWorkspace
              feed={feed}
              feedFailure={feedFailure}
              inspectorAvailable={panels.inspectorAvailable}
              inspectorOpen={panels.inspectorVisible}
              loading={loading}
              noSessions={!loading && sessions.length === 0}
              onReread={props.onReread}
              onShowInspector={() => panels.setInspectorOpen(true)}
              onShowRoster={() => panels.setRosterOpen(true)}
              selected={selected}
              selectedSessionId={selectedSessionId}
              composerContent={props.composerContent}
            />
            {panels.inspectorVisible && selected !== null ? (
              <SessionInspector
                onCollapse={() => panels.setInspectorOpen(false)}
                session={selected}
              />
            ) : null}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}

function sessionRoster(
  props: SessionPageProps,
  onSelect: (sessionId: SessionId) => void,
  onCollapse: () => void,
) {
  return (
    <SessionRoster
      failure={props.failure}
      loading={props.loading}
      onCollapse={onCollapse}
      onReread={props.onReread}
      onSelect={onSelect}
      projectName={props.projectName}
      selectedSessionId={props.selectedSessionId}
      sessions={props.sessions}
    />
  )
}
