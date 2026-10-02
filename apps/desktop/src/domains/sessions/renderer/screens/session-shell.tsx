import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppPageHeader } from '@/platform/renderer/app/components/app-shell'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  InspectorHeaderControls,
  InspectorSplit,
} from '@/platform/renderer/shell/inspector-split/inspector-split'
import { SessionTitle } from '../prompt'
import type { Session } from '../types'
import { SESSION_SPLIT } from './session-screen-layout'
import type { SessionLocation } from './session-screen-location'
import { SessionWorkspace, type SessionWorkspaceProps } from './session-workspace'

import './session-screen.css'

type SessionShellProps = Omit<SessionWorkspaceProps, 'header'> & {
  // The workspace header's own controls, drawn leading. A Session with no background work hands
  // nothing here and the bar stays empty (#1582).
  headerControls?: ReactNode
  session?: Pick<Session, 'harness' | 'name'> | null
  // The folder the header names under the title, read-only, and the worktree's base branch.
  location?: SessionLocation | null
  inspector: ReactNode
  inspectorBar?: ReactNode
  defaultInspectorCollapsed?: boolean
  inspectorReveal?: string | null
}

// The Feed's inline-code look, so a path or branch reads as a ref.
const REF_CHIP = 'min-w-0 truncate rounded-md bg-muted px-1 font-mono'

// The folder is cut at its start, so its end, which names the worktree, stays in view.
function SessionLocationMetadata({ location }: { location: SessionLocation }) {
  const { t } = useTranslation('sessions')
  return (
    <p
      data-component="SessionLocationMetadata"
      className="flex w-full min-w-0 items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground"
    >
      <Icon name="branch" className="size-(--size-icon-inline) shrink-0" />
      <code className={`${REF_CHIP} min-w-24 text-left [direction:rtl]`} title={location.path}>
        <span dir="ltr">{location.path}</span>
      </code>
      {location.base !== null ? (
        <>
          <span className="shrink-0">{t('identity.from')}</span>
          <code className={`${REF_CHIP} max-w-2/5 shrink-0`} title={location.base}>
            {location.base}
          </code>
        </>
      ) : null}
    </p>
  )
}

function SessionIdentity({
  session,
  location,
}: {
  session: SessionShellProps['session']
  location: SessionLocation | null
}) {
  if (session === null || session === undefined) return null
  return (
    <div
      data-component="SessionIdentity"
      className="flex min-w-0 flex-1 flex-col items-start justify-center gap-(--spacing-shell-tight)"
    >
      <h1 className="w-full truncate type-heading">
        <SessionTitle session={session} />
      </h1>
      {location !== null ? <SessionLocationMetadata location={location} /> : null}
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
  location = null,
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
                <SessionIdentity location={location} session={session} />
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
