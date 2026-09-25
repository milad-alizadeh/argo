import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppPageHeader } from '@/platform/renderer/app/components/app-shell'
import {
  InspectorHeaderControls,
  InspectorSplit,
} from '@/platform/renderer/cockpit/inspector-split/inspector-split'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { SessionTitle } from '../prompt/session-title'
import { sessionName } from '../session-list/rows/session-list-rows'
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
    <div
      data-component="SessionIdentity"
      className="flex min-w-0 flex-1 flex-col items-start justify-center gap-(--spacing-shell-tight)"
    >
      <h1 className="w-full truncate type-heading">
        <SessionTitle session={session} text={sessionName(session, t('newSession'))} />
      </h1>
      <div
        data-component="SessionMetadata"
        className="flex w-full min-w-0 items-center gap-(--spacing-shell-section) type-meta text-muted-foreground"
      >
        <p
          data-component="SessionIdMetadata"
          className="flex min-w-0 max-w-40 items-center gap-(--spacing-shell-tight)"
        >
          <Icon name="session" size="meta" />
          <span className="shrink-0">{t('identity.sessionId')}</span>
          <code className="min-w-0 truncate font-mono text-foreground">{session.id}</code>
        </p>
        {worktree ? (
          <p className="flex min-w-0 max-w-48 items-center gap-(--spacing-shell-tight)">
            <Icon name="worktree" className="size-(--size-icon-inline) shrink-0" />
            <span className="shrink-0">{t('identity.worktree')}</span>
            <span className="min-w-0 truncate">{worktree}</span>
          </p>
        ) : null}
      </div>
    </div>
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
        defaultCollapsed={defaultInspectorCollapsed}
        inspector={inspector}
        noun="Session"
        reveal={inspectorReveal}
        sizes={SESSION_SPLIT}
        workspace={
          <SessionWorkspace
            {...workspaceProps}
            header={
              <AppPageHeader>
                <SessionIdentity session={session} />
                <SessionHeaderControls>
                  {headerControls}
                  <InspectorHeaderControls />
                </SessionHeaderControls>
              </AppPageHeader>
            }
          />
        }
      />
    </main>
  )
}
