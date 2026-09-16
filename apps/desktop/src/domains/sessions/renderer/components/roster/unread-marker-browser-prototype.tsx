import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { sessionRosterRow } from '../../session-fixtures'
import {
  isSignatureLoaderKey,
  SIGNATURE_LOADERS,
  type SignatureLoaderKey,
  SignatureRunningLoader,
} from './running-loader-gallery-prototype'
import { SessionRosterItem } from './session-roster-item'
import { SessionsSidebarHeader } from './sessions-sidebar-chrome'

const FAMILIES = ['Orbital', 'Linear', 'Geometric', 'Signal'] as const

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

function loaderFromLocation(): SignatureLoaderKey {
  const query = window.location.hash.split('?')[1] ?? ''
  const loader = new URLSearchParams(query).get('loader')
  return isSignatureLoaderKey(loader) ? loader : 'comet'
}

function replaceLoader(loader: SignatureLoaderKey) {
  const query = window.location.hash.split('?')[1] ?? ''
  const search = new URLSearchParams(query)
  search.set('variant', 'A')
  search.set('loader', loader)
  window.history.replaceState(null, '', `#/sessions?${search.toString()}`)
}

function PrototypeRoster({ loader }: { loader: SignatureLoaderKey }) {
  return (
    <MemoryRouter initialEntries={['/sessions?variant=A']}>
      <aside
        aria-label="Sessions"
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
              prototypeRunningLoader={loader}
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

function LoaderOption({
  loader,
  onSelect,
  selected,
}: {
  loader: (typeof SIGNATURE_LOADERS)[number]
  onSelect: (loader: SignatureLoaderKey) => void
  selected: boolean
}) {
  return (
    <button
      aria-pressed={selected}
      className={`group flex min-h-12 items-center gap-3 rounded-lg px-3 text-left transition-colors ${selected ? 'bg-selected text-foreground' : 'hover:bg-muted'}`}
      onClick={() => onSelect(loader.key)}
      type="button"
    >
      <span className="flex w-7 justify-center text-foreground">
        <SignatureRunningLoader loader={loader.key} />
      </span>
      <span className="type-body font-medium">{loader.name}</span>
    </button>
  )
}

// PROTOTYPE: twenty running signatures beside the production Session roster.
export function UnreadMarkerBrowserPrototype() {
  const [selected, setSelected] = useState<SignatureLoaderKey>(loaderFromLocation)
  const select = (loader: SignatureLoaderKey) => {
    setSelected(loader)
    replaceLoader(loader)
  }
  const selectedName = SIGNATURE_LOADERS.find((loader) => loader.key === selected)?.name
  return (
    <main className="flex h-dvh overflow-hidden bg-background text-foreground">
      <PrototypeRoster loader={selected} />
      <section className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <header className="mb-7 flex items-end justify-between gap-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Choose Argo's running mark</h1>
            <p className="mt-1 max-w-xl type-body text-muted-foreground">
              Twenty roster-scale loaders. Blue remains unread, gray remains read, and yellow still
              overrides both when a Session needs you.
            </p>
          </div>
          <output className="shrink-0 type-meta text-faint">Selected: {selectedName}</output>
        </header>
        <div className="space-y-7">
          {FAMILIES.map((family) => (
            <section key={family}>
              <h2 className="mb-2 type-meta font-medium text-faint">{family}</h2>
              <div className="grid grid-cols-2 gap-1">
                {SIGNATURE_LOADERS.filter((loader) => loader.family === family).map((loader) => (
                  <LoaderOption
                    key={loader.key}
                    loader={loader}
                    onSelect={select}
                    selected={loader.key === selected}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}
