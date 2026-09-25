import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CockpitContentChrome } from '@/platform/renderer/cockpit/components/cockpit-content-chrome'
import { InspectorSplit } from '@/platform/renderer/cockpit/inspector-split/inspector-split'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { SessionTitle } from '../prompt/session-title'
import { sessionName } from '../roster/rows/roster-rows'
import type { Session } from '../types'
import { SESSION_SPLIT } from './session-screen-layout'
import { SessionWorkspace, type SessionWorkspaceProps } from './session-workspace'
import { worktreeName } from './session-worktree'

import './session-screen.css'

type SessionShellProps = Omit<SessionWorkspaceProps, 'header'> & {
  // The workspace header's own controls, drawn leading. A Session with no background work hands
  // nothing here and the bar stays empty (#1582).
  headerControls?: ReactNode
  session?: Pick<Session, 'cwd' | 'harness' | 'id' | 'status' | 'title'> | null
  inspector: ReactNode
  inspectorBar?: ReactNode
  defaultInspectorCollapsed?: boolean
  inspectorReveal?: string | null
}

function SessionIdentity({ session }: { session: SessionShellProps['session'] }) {
  const { t } = useTranslation('sessions')
  if (session === null || session === undefined) return null
  const worktree = worktreeName(session.cwd)
  return (
    <header
      data-component="SessionIdentity"
      className="grid min-w-0 shrink-0 gap-(--spacing-shell-item) border-b border-border/60 px-(--spacing-session-gutter) py-(--spacing-shell-inset)"
    >
      <h1 className="min-w-0 type-title wrap-anywhere">
        <SessionTitle session={session} text={sessionName(session, t('newSession'))} />
      </h1>
      <div className="flex min-w-0 flex-wrap items-center gap-x-(--spacing-shell-section) gap-y-(--spacing-shell-item) type-meta text-muted-foreground">
        <p
          data-component="SessionIdMetadata"
          className="flex min-w-0 items-center gap-(--spacing-shell-tight)"
        >
          <Icon name="session" size="meta" />
          <span>{t('identity.sessionId')}</span>
          <code className="max-w-64 truncate font-mono text-foreground">{session.id}</code>
        </p>
        {worktree ? (
          <p className="flex min-w-0 items-center gap-(--spacing-shell-tight)">
            <Icon name="worktree" className="size-(--size-icon-inline) shrink-0" />
            <span>{t('identity.worktree')}</span>
            <span className="truncate">{worktree}</span>
          </p>
        ) : null}
      </div>
    </header>
  )
}

function SessionHeaderControls({ children }: { children: ReactNode }) {
  return (
    <div
      data-component="SessionHeaderControls"
      className="no-drag-region ml-auto flex shrink-0 items-center gap-1"
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
              <>
                <CockpitContentChrome data-component="SessionHeader">
                  <SessionHeaderControls>{headerControls}</SessionHeaderControls>
                </CockpitContentChrome>
                <SessionIdentity session={session} />
              </>
            }
          />
        }
      />
    </main>
  )
}
