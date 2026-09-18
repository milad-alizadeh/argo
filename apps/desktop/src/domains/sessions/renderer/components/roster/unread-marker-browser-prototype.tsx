import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { Loader, type LoaderSize } from '../../../../../platform/renderer/components/loader'
import { sessionRosterRow } from '../../session-fixtures'
import { SessionRosterItem } from './session-roster-item'
import { SessionsSidebarHeader } from './sessions-sidebar-chrome'

const LOADER_SIZES = [
  { key: 'meta', name: 'Meta', pixels: 12, use: 'Session rows and metadata' },
  { key: 'control', name: 'Control', pixels: 16, use: 'Buttons, markers, and toasts' },
  { key: 'standard', name: 'Standard', pixels: 28, use: 'Feed and panel loading' },
  { key: 'prominent', name: 'Prominent', pixels: 40, use: 'Large waiting states' },
] as const satisfies readonly {
  key: LoaderSize
  name: string
  pixels: number
  use: string
}[]

const ROWS = [
  {
    session: sessionRosterRow({
      id: 'running-read',
      cli: 'codex',
      cwd: '/Users/milad/Developer/argo',
      posture: 'external',
      status: 'running',
      title: { text: 'Implement unread Session notifications', source: 'first-prompt' },
    }),
    unread: false,
  },
  {
    session: sessionRosterRow({
      id: 'running-unread',
      cli: 'claude',
      cwd: '/Users/milad/Developer/argo',
      posture: 'external',
      status: 'running',
      title: { text: 'Review the state model', source: 'summarised' },
    }),
    unread: true,
  },
  {
    session: sessionRosterRow({
      id: 'idle-unread',
      cli: 'codex',
      cwd: '/Users/milad/Developer/argo',
      posture: 'external',
      status: 'idle',
      title: { text: 'Refine Session filters', source: 'summarised' },
    }),
    unread: true,
  },
  {
    session: sessionRosterRow({
      id: 'idle-read',
      cli: 'claude',
      cwd: '/Users/milad/Developer/argo',
      posture: 'external',
      status: 'idle',
      title: { text: 'Prepare release notes', source: 'summarised' },
    }),
    unread: false,
  },
  {
    session: sessionRosterRow({
      id: 'blocked-unread',
      cli: 'codex',
      cwd: '/Users/milad/Developer/argo',
      posture: 'managed',
      status: 'asking',
      title: { text: 'Choose how to continue', source: 'summarised' },
    }),
    unread: true,
  },
] as const

function clearRejectedLoaderChoice() {
  const query = window.location.hash.split('?')[1] ?? ''
  const search = new URLSearchParams(query)
  search.set('variant', 'A')
  search.delete('loader')
  window.history.replaceState(null, '', `#/sessions?${search.toString()}`)
}

function PrototypeRoster() {
  const { t } = useTranslation('sessions')
  return (
    <MemoryRouter initialEntries={['/sessions?variant=A']}>
      <aside
        aria-label={t('loaderPrototype.sessions')}
        className="flex h-dvh w-80 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar"
      >
        <SessionsSidebarHeader
          onNew={() => undefined}
          onSearch={() => undefined}
          onStatusChange={() => undefined}
          search=""
          status="active"
        />
        <div className="min-h-0 flex-1 overflow-hidden py-1">
          {ROWS.map(({ session, unread }, index) => (
            <SessionRosterItem
              archived={false}
              checked={false}
              key={session.id}
              onFocus={() => undefined}
              onSelect={() => undefined}
              onToggleSelect={() => undefined}
              prototypeUnread={unread}
              selectable={false}
              selected={index === 0}
              session={session}
              tabIndex={index === 0 ? 0 : -1}
            />
          ))}
        </div>
      </aside>
    </MemoryRouter>
  )
}

function LoaderSample({
  size,
  name,
  pixels,
  use,
}: {
  size: LoaderSize
  name: string
  pixels: number
  use: string
}) {
  const { t } = useTranslation('sessions')
  return (
    <div className="flex min-h-20 items-center gap-4 border-b border-border/60 py-3 last:border-b-0">
      <span className="flex w-12 justify-center">
        <Loader aria-label={t('loaderPrototype.label', { name })} size={size} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block type-body font-medium">{name}</span>
        <span className="block type-meta text-muted-foreground">{use}</span>
      </span>
      <span className="type-meta tabular-nums text-faint">
        {t('loaderPrototype.pixels', { pixels })}
      </span>
    </div>
  )
}

// PROTOTYPE: the selected Loader at every production size beside the production Session roster.
export function UnreadMarkerBrowserPrototype() {
  const { t } = useTranslation('sessions')
  useEffect(clearRejectedLoaderChoice, [])
  return (
    <main className="flex h-dvh overflow-hidden bg-background text-foreground">
      <PrototypeRoster />
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{t('loaderPrototype.title')}</h1>
          <p className="mt-1 max-w-xl type-body text-muted-foreground">
            {t('loaderPrototype.description')}
          </p>
        </header>
        <div className="max-w-2xl border-y border-border/60">
          {LOADER_SIZES.map(({ key, ...sample }) => (
            <LoaderSample key={key} size={key} {...sample} />
          ))}
        </div>
      </section>
    </main>
  )
}
