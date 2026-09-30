import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppPageHeader } from '@/platform/renderer/app/components/app-shell'
import {
  InspectorHeaderControls,
  InspectorSplit,
} from '@/platform/renderer/cockpit/inspector-split/inspector-split'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { SessionTitle } from '../prompt'
import type { Session } from '../types'
import { SESSION_SPLIT } from './session-screen-layout'
import type { SessionWorkspaceIdentity } from './session-screen-workspace'
import { SessionWorkspace, type SessionWorkspaceProps } from './session-workspace'

import './session-screen.css'

type SessionShellProps = Omit<SessionWorkspaceProps, 'header'> & {
  // The workspace header's own controls, drawn leading. A Session with no background work hands
  // nothing here and the bar stays empty (#1582).
  headerControls?: ReactNode
  session?: Pick<Session, 'harness' | 'name'> | null
  workspaceIdentity?: SessionWorkspaceIdentity | null
  inspector: ReactNode
  inspectorBar?: ReactNode
  defaultInspectorCollapsed?: boolean
  inspectorReveal?: string | null
}

function SessionIdentity({
  session,
  workspaceIdentity,
}: {
  session: SessionShellProps['session']
  workspaceIdentity: SessionWorkspaceIdentity | null
}) {
  const { t } = useTranslation('sessions')
  if (session === null || session === undefined) return null
  return (
    <div
      data-component="SessionIdentity"
      className="flex min-w-0 flex-1 flex-col items-start justify-center gap-(--spacing-shell-tight)"
    >
      <h1 className="w-full truncate type-heading">
        <SessionTitle session={session} text={session.name ?? t('newSession')} />
      </h1>
      {workspaceIdentity !== null && workspaceIdentity.branch !== null ? (
        <div
          data-component="SessionMetadata"
          className="w-full min-w-0 type-meta text-muted-foreground"
        >
          <p
            data-component="SessionBranchMetadata"
            className="flex min-w-0 max-w-48 items-center gap-(--spacing-shell-tight)"
          >
            <Icon name="branch" className="size-(--size-icon-inline) shrink-0" />
            <span className="shrink-0">{t('identity.branch')}</span>
            <span className="min-w-0 truncate">{workspaceIdentity.branch}</span>
          </p>
        </div>
      ) : null}
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
  workspaceIdentity = null,
  inspector,
  inspectorBar = null,
  defaultInspectorCollapsed = false,
  inspectorReveal = null,
  ...workspaceProps
}: SessionShellProps) {
  return (
    <main
      data-component="SessionShell"
      className="session-screen__shell panel-frame relative overflow-hidden"
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
                <SessionIdentity session={session} workspaceIdentity={workspaceIdentity} />
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
