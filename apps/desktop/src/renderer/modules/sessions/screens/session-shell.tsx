import { GitFork } from 'lucide-react'
import type { ReactNode } from 'react'

import { InspectorSplit } from '../../../components/inspector-split'
import type { Session } from '../types'
import { SESSION_SPLIT } from './session-screen-layout'
import { SessionWorkspace, type SessionWorkspaceProps } from './session-workspace'
import { worktreeName } from './session-worktree'

import './session-screen.css'

type SessionShellProps = Omit<SessionWorkspaceProps, 'header'> & {
  // The workspace header's own controls, drawn leading. A Session with no background work hands
  // nothing here and the bar stays empty (#1582).
  headerControls?: ReactNode
  session?: Pick<Session, 'cwd' | 'id' | 'title'> | null
  inspector: ReactNode
  inspectorBar?: ReactNode
  defaultInspectorCollapsed?: boolean
  inspectorReveal?: string | null
}

function SessionHeader({ session }: { session: SessionShellProps['session'] }) {
  if (session === null || session === undefined) return null
  const worktree = worktreeName(session.cwd)
  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      <h1 className="truncate type-heading font-medium">{session.title?.text ?? session.id}</h1>
      {worktree ? (
        <p className="mt-1 flex min-w-0 items-center gap-1 type-meta text-muted-foreground">
          <GitFork aria-hidden="true" className="size-(--size-icon-inline) shrink-0" />
          <span className="truncate">{worktree}</span>
        </p>
      ) : null}
    </div>
  )
}

function SessionHeaderControls({ children }: { children: ReactNode }) {
  return (
    <div
      data-component="SessionHeaderControls"
      className="ml-auto flex shrink-0 items-center gap-1"
    >
      {children}
    </div>
  )
}

export function SessionShell({
  headerControls = null,
  session = null,
  inspector,
  inspectorBar = null,
  defaultInspectorCollapsed = false,
  inspectorReveal = null,
  ...workspaceProps
}: SessionShellProps) {
  return (
    <main
      data-component="SessionShell"
      className="session-screen__shell relative h-full min-h-0 overflow-hidden bg-background"
    >
      <InspectorSplit
        bar={inspectorBar}
        inspector={inspector}
        defaultCollapsed={defaultInspectorCollapsed}
        noun="Session"
        reveal={inspectorReveal}
        sizes={SESSION_SPLIT}
        workspace={
          <SessionWorkspace
            {...workspaceProps}
            header={
              <header
                data-component="SessionHeader"
                className="flex h-(--size-chrome-bar) shrink-0 items-center gap-2 border-b border-border/60 bg-background px-(--spacing-shell-gutter)"
              >
                <SessionHeader session={session} />
                <SessionHeaderControls>{headerControls}</SessionHeaderControls>
              </header>
            }
          />
        }
      />
    </main>
  )
}
