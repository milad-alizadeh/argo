import { Expand, Minimize2, PanelRight } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'
import { useNavigate, useParams } from 'react-router'

import { Button } from '../../../components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../../components/ui/resizable'
import { readCssSize } from '../../../lib/read-css-size'
import { useProjects } from '../../projects/hooks/useProjects'
import { SessionComposerArea, SessionFacts } from '../components/SessionScreenDetails'
import { BasicFeed } from '../feed/BasicFeed'
import { useClaudeComposer } from '../hooks/useClaudeComposer'
import { useClaudePermission } from '../hooks/useClaudePermission'
import { useSessions } from '../hooks/useSessions'

type SessionInspectorState = 'open' | 'collapsed' | 'expanded'

type SessionShellProps = {
  composer: ReactNode
  inspector: ReactNode
  inspectorState: SessionInspectorState
  onToggleInspector: () => void
  onToggleInspectorExpanded: () => void
  inspectorPanelRef: ReturnType<typeof usePanelRef>
  workspacePanelRef: ReturnType<typeof usePanelRef>
  onLayoutChanged: () => void
  feed: ReturnType<typeof useSessions>['feed']
  feedError: ReturnType<typeof useSessions>['feedError']
  selectedSessionId: string | null
}

export function SessionScreenView() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const newSession = sessionId === 'new'
  const selectedSessionId = newSession ? null : (sessionId ?? null)
  const { feed, feedError, roster } = useSessions(selectedSessionId)
  const composer = useClaudeComposer({ cockpit, navigate, roster, selectedSessionId })
  const permission = useClaudePermission(selectedSessionId)
  const session = roster?.sessions.find(({ id }) => id === selectedSessionId) ?? null
  const inspectorPanelRef = usePanelRef()
  const workspacePanelRef = usePanelRef()
  const [inspectorState, setInspectorState] = useState<SessionInspectorState>('open')

  const synchronizeInspectorCollapsed = () => {
    if (inspectorPanelRef.current?.isCollapsed()) {
      setInspectorState('collapsed')
      return
    }
    setInspectorState((state) => (state === 'expanded' ? state : 'open'))
  }

  const toggleInspector = () => {
    if (inspectorState === 'collapsed') {
      inspectorPanelRef.current?.expand()
      inspectorPanelRef.current?.resize(readCssSize('--size-session-inspector'))
      setInspectorState('open')
    } else {
      if (inspectorState === 'expanded') workspacePanelRef.current?.expand()
      inspectorPanelRef.current?.collapse()
      setInspectorState('collapsed')
    }
  }

  const toggleInspectorExpanded = () => {
    const expanded = inspectorState === 'expanded'
    workspacePanelRef.current?.[expanded ? 'expand' : 'collapse']()
    setInspectorState(expanded ? 'open' : 'expanded')
  }

  return (
    <SessionShell
      inspectorState={inspectorState}
      inspectorPanelRef={inspectorPanelRef}
      workspacePanelRef={workspacePanelRef}
      onLayoutChanged={synchronizeInspectorCollapsed}
      onToggleInspector={toggleInspector}
      onToggleInspectorExpanded={toggleInspectorExpanded}
      feed={feed}
      feedError={feedError}
      selectedSessionId={selectedSessionId}
      composer={
        <SessionComposerArea composer={composer} permission={permission} session={session} />
      }
      inspector={<SessionFacts session={session} />}
    />
  )
}

export function SessionShell({
  composer,
  inspector,
  inspectorState,
  inspectorPanelRef,
  workspacePanelRef,
  onLayoutChanged,
  onToggleInspector,
  onToggleInspectorExpanded,
  feed,
  feedError,
  selectedSessionId,
}: SessionShellProps) {
  const inspectorCollapsed = inspectorState === 'collapsed'
  const inspectorExpanded = inspectorState === 'expanded'
  const inspectorDefaultWidth = readCssSize('--size-session-inspector')
  const inspectorMinWidth = readCssSize('--size-session-inspector-min')
  const workspaceMinWidth = readCssSize('--size-session-workspace-min')

  return (
    <main
      data-component="SessionShell"
      className="relative h-full min-h-0 overflow-hidden bg-background"
    >
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full"
        onLayoutChanged={onLayoutChanged}
      >
        <ResizablePanel
          id="session-workspace"
          panelRef={workspacePanelRef}
          collapsible
          collapsedSize={0}
          minSize={workspaceMinWidth}
        >
          <section aria-label="Session workspace" className="flex h-full min-h-0 flex-col">
            <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 bg-background px-(--spacing-shell-gutter)">
              <span className="flex-1" />
            </header>
            <section aria-label="Session feed" className="min-h-0 flex-1">
              <BasicFeed feed={feed} failure={feedError} selectedSessionId={selectedSessionId} />
            </section>
            <section aria-label="Session composer" className="shrink-0 border-t border-border/60">
              {composer}
            </section>
          </section>
        </ResizablePanel>
        <ResizableHandle className={inspectorCollapsed ? 'bg-transparent' : 'bg-border/60'} />
        <ResizablePanel
          id="session-inspector"
          collapsible
          collapsedSize={0}
          defaultSize={inspectorDefaultWidth}
          groupResizeBehavior="preserve-pixel-size"
          minSize={inspectorMinWidth}
          panelRef={inspectorPanelRef}
        >
          <aside aria-label="Session inspector" className="flex h-full min-h-0 flex-col bg-sidebar">
            <header className="h-(--size-chrome-bar) shrink-0 border-b border-border/60 bg-sidebar" />
            {inspector}
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
      <div className="absolute top-0 right-(--spacing-shell-gutter) z-20 flex h-(--size-chrome-bar) items-center gap-(--spacing-shell-tight)">
        {inspectorCollapsed ? (
          <Button
            aria-label="Open Session inspector"
            variant="secondary"
            size="icon-sm"
            onClick={onToggleInspector}
          >
            <PanelRight />
          </Button>
        ) : (
          <>
            <Button
              aria-label={inspectorExpanded ? 'Restore Session sidebar' : 'Expand Session sidebar'}
              variant="ghost"
              size="icon-sm"
              onClick={onToggleInspectorExpanded}
            >
              {inspectorExpanded ? <Minimize2 /> : <Expand />}
            </Button>
            <Button
              aria-label="Collapse Session inspector"
              variant="secondary"
              size="icon-sm"
              onClick={onToggleInspector}
            >
              <PanelRight />
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
