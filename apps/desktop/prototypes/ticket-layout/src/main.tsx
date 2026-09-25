// Three paired Session/Ticket shell variants, switchable with ?variant=A|B|C.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Filter,
  GitBranch,
  LayoutList,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Ticket,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './prototype.css'
import './detail.css'

type Surface = 'sessions' | 'tickets'
type Variant = 'A' | 'B' | 'C'

const variants: Record<Variant, { name: string; note: string }> = {
  A: {
    name: 'Context dock',
    note: 'The shell dock changes with the surface. Lists live in the dock; focused work owns the canvas.',
  },
  B: {
    name: 'Workbench',
    note: 'The shell sidebar stays global. Each surface owns its list and detail panes inside the workspace.',
  },
  C: {
    name: 'Focus flow',
    note: 'Opening work compresses the list into a recall strip, giving the active object almost the full window.',
  },
}

const sessions = [
  { title: 'Redesign the ticket page', state: 'Working', time: 'now', active: true },
  { title: 'Restore session startup', state: 'Waiting for you', time: '8m' },
  { title: 'Review SQLite read models', state: 'Complete', time: '31m' },
  { title: 'Trusted subscription transport', state: 'Complete', time: '1h' },
  { title: 'Audit agent instructions', state: 'Paused', time: '3h' },
  { title: 'Fix harness catalogue', state: 'Complete', time: 'Yesterday' },
]

const tickets = [
  {
    key: '#2739',
    title: 'Redesign Ticket workspace around long queues and readable detail',
    labels: ['design', 'desktop'],
    age: '2h',
    active: true,
  },
  {
    key: '#2736',
    title: 'Use a trusted tRPC subscription transport',
    labels: ['desktop'],
    age: '6h',
  },
  {
    key: '#2733',
    title: 'Restore development startup to an existing Session screen',
    labels: ['bug', 'session'],
    age: '1d',
  },
  {
    key: '#2727',
    title: 'Model Codex app-server lifecycle with XState',
    labels: ['architecture'],
    age: '2d',
  },
  {
    key: '#2725',
    title: 'Move Harness catalogue to the typed domain model',
    labels: ['domain'],
    age: '3d',
  },
  {
    key: '#2723',
    title: 'Index Sessions without blocking the cockpit',
    labels: ['performance'],
    age: '4d',
  },
  {
    key: '#2703',
    title: 'Read and sync Linear Tickets through SQLite',
    labels: ['linear', 'storage'],
    age: '1w',
  },
  {
    key: '#2689',
    title: 'Read and sync GitHub Tickets through SQLite',
    labels: ['github', 'storage'],
    age: '1w',
  },
]

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button aria-label={label} className="icon-button" type="button">
      {children}
    </button>
  )
}

function NavigationRail({
  surface,
  onSurface,
}: {
  surface: Surface
  onSurface: (value: Surface) => void
}) {
  return (
    <nav aria-label="Argo" className="navigation-rail">
      <div className="window-grip" />
      <div className="argo-mark">A</div>
      <button
        aria-current={surface === 'sessions' ? 'page' : undefined}
        aria-label="Sessions"
        className="rail-button"
        onClick={() => onSurface('sessions')}
        type="button"
      >
        <MessageSquare />
      </button>
      <button
        aria-current={surface === 'tickets' ? 'page' : undefined}
        aria-label="Tickets"
        className="rail-button"
        onClick={() => onSurface('tickets')}
        type="button"
      >
        <Ticket />
      </button>
      <button aria-label="Atlas" className="rail-button" type="button">
        <Boxes />
      </button>
      <div className="rail-spacer" />
      <button aria-label="Settings" className="rail-button" type="button">
        <Settings2 />
      </button>
    </nav>
  )
}

function ProjectChrome({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`project-chrome ${compact ? 'project-chrome--compact' : ''}`}>
      <IconButton label="Collapse sidebar">
        <PanelLeftClose />
      </IconButton>
      <button className="project-switcher" type="button">
        <span className="project-avatar">AR</span>
        {!compact ? <span>Argo</span> : null}
        <ChevronDown />
      </button>
    </div>
  )
}

function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <label className="search-bar">
      <Search />
      <span className="sr-only">{placeholder}</span>
      <input placeholder={placeholder} />
      <kbd>⌘K</kbd>
    </label>
  )
}

function SessionList({ dense = false, limit }: { dense?: boolean; limit?: number }) {
  return (
    <div className={`session-list ${dense ? 'session-list--dense' : ''}`}>
      {sessions.slice(0, limit).map((session) => (
        <button
          className="session-row"
          data-active={session.active || undefined}
          key={session.title}
          type="button"
        >
          <span
            className={`presence presence--${session.state.toLowerCase().replaceAll(' ', '-')}`}
          />
          <span className="session-row__copy">
            <strong>{session.title}</strong>
            <span>{session.state}</span>
          </span>
          <time>{session.time}</time>
        </button>
      ))}
    </div>
  )
}

function TicketList({ dense = false, limit }: { dense?: boolean; limit?: number }) {
  return (
    <div className={`ticket-list ${dense ? 'ticket-list--dense' : ''}`}>
      {tickets.slice(0, limit).map((ticket) => (
        <button
          className="ticket-row"
          data-active={ticket.active || undefined}
          key={ticket.key}
          type="button"
        >
          <span className="ticket-row__lead">
            <CircleDot />
            <span className="ticket-key">{ticket.key}</span>
          </span>
          <strong>{ticket.title}</strong>
          <span className="ticket-row__meta">
            <span className="labels">
              {ticket.labels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </span>
            <time>{ticket.age}</time>
          </span>
        </button>
      ))}
    </div>
  )
}

function ListHeader({ surface, compact = false }: { surface: Surface; compact?: boolean }) {
  const isSession = surface === 'sessions'
  return (
    <div className={`list-header ${compact ? 'list-header--compact' : ''}`}>
      <SearchBar placeholder={isSession ? 'Search Sessions…' : 'Search Tickets…'} />
      <IconButton label={isSession ? 'Filter Sessions' : 'Filter Tickets'}>
        <Filter />
      </IconButton>
      <IconButton label={isSession ? 'New Session' : 'Ticket views'}>
        {isSession ? <Plus /> : <SlidersHorizontal />}
      </IconButton>
    </div>
  )
}

function SessionWorkspace({ roomy = false }: { roomy?: boolean }) {
  return (
    <main className={`session-workspace ${roomy ? 'session-workspace--roomy' : ''}`}>
      <header className="work-header">
        <div>
          <h1>Redesign the ticket page</h1>
          <p>
            <GitBranch /> ticket-ticket-page-layout-prototype
          </p>
        </div>
        <div className="work-actions">
          <button className="quiet-action" type="button">
            <Bot /> 2
          </button>
          <button aria-label="Archive Session" className="quiet-action" type="button">
            <Archive />
          </button>
          <button aria-label="More Session actions" className="quiet-action" type="button">
            <MoreHorizontal />
          </button>
        </div>
      </header>
      <div className="transcript">
        <article className="prompt-card">
          <p>
            I want to redesign the ticket page a bit. The Session page requires a roster, but the
            same sidebar does not make sense for Tickets.
          </p>
        </article>
        <article className="agent-turn">
          <span className="agent-mark">
            <Sparkles />
          </span>
          <div>
            <p>
              The current shell gives both surfaces the same left-column contract even though their
              information architecture is different.
            </p>
            <p>
              I’m comparing three ways to make the Ticket queue and detail feel deliberate without
              damaging the Session roster.
            </p>
          </div>
        </article>
        <section className="progress-block">
          <header>
            <Check /> <strong>Mapped the current shell</strong>
            <span>4 files</span>
          </header>
          <div className="progress-line">
            <span />
            <p>Ticket detail is constrained by two persistent columns before it.</p>
          </div>
          <div className="progress-line">
            <span />
            <p>The Ticket shell sidebar carries only one useful view.</p>
          </div>
          <div className="progress-line">
            <span />
            <p>
              The Session roster earns its width through selection, state, search, and creation.
            </p>
          </div>
        </section>
      </div>
      <div className="composer">
        <div className="composer-input">Ask a follow-up…</div>
        <button aria-label="Send message" type="button">
          <ArrowRight />
        </button>
      </div>
    </main>
  )
}

function TicketDetail({ roomy = false }: { roomy?: boolean }) {
  return (
    <main className={`ticket-detail ${roomy ? 'ticket-detail--roomy' : ''}`}>
      <header className="work-header ticket-toolbar">
        <div className="ticket-breadcrumb">
          <span>Tickets</span>
          <span>/</span>
          <strong>#2739</strong>
        </div>
        <div className="work-actions">
          <button className="primary-action" type="button">
            <Sparkles /> Start Session
          </button>
          <button aria-label="More Ticket actions" className="quiet-action" type="button">
            <MoreHorizontal />
          </button>
        </div>
      </header>
      <article className="ticket-document">
        <header className="ticket-document__header">
          <span className="ticket-kicker">
            <CircleDot /> Open <span>·</span> #2739
          </span>
          <h1>Redesign Ticket workspace around long queues and readable detail</h1>
          <div className="ticket-properties">
            <button type="button">
              <span className="status-dot" /> Open <ChevronDown />
            </button>
            <button type="button">
              <span className="priority-mark">◒</span> High <ChevronDown />
            </button>
            <span className="label-chip">design</span>
            <span className="label-chip">desktop</span>
          </div>
        </header>
        <section className="ticket-body">
          <p>
            The Session page requires a roster, and the sidebar works well there. Tickets need a
            longer, searchable queue, but the current shell reserves the sidebar for filters and
            pushes the actual list into the middle pane.
          </p>
          <p>
            This leaves the Ticket detail squeezed between two navigation ideas. Rework the
            hierarchy so each surface gets the space its primary job requires.
          </p>
          <h2>What this needs to solve</h2>
          <ul>
            <li>Long Ticket titles remain scannable in the queue.</li>
            <li>Search and filters stay attached to the list they change.</li>
            <li>Ticket detail has a comfortable reading measure.</li>
            <li>The Session roster remains fast to scan and switch.</li>
          </ul>
          <h2>Linked Sessions</h2>
          <button className="linked-session" type="button">
            <span className="presence presence--working" />
            <span>
              <strong>Redesign the ticket page</strong>
              <small>Working now</small>
            </span>
            <ArrowRight />
          </button>
        </section>
      </article>
    </main>
  )
}

function ContextDock({ surface }: { surface: Surface }) {
  return (
    <div className="layout layout--a">
      <aside className={`context-dock context-dock--${surface}`}>
        <ProjectChrome />
        <ListHeader surface={surface} />
        <div className="dock-heading">
          <h2>{surface === 'sessions' ? 'Sessions' : 'All open'}</h2>
          <span>{surface === 'sessions' ? '18' : '68+'}</span>
        </div>
        {surface === 'sessions' ? <SessionList /> : <TicketList />}
        <footer className="dock-footer">
          {surface === 'sessions' ? (
            <>
              <Clock3 /> Archived Sessions
            </>
          ) : (
            <>
              <GitBranch /> GitHub · milad-alizadeh/argo
            </>
          )}
        </footer>
      </aside>
      {surface === 'sessions' ? <SessionWorkspace roomy /> : <TicketDetail roomy />}
    </div>
  )
}

function GlobalSidebar({ surface }: { surface: Surface }) {
  return (
    <aside className="global-sidebar">
      <ProjectChrome />
      <div className="global-sidebar__section">
        <span className="section-label">Workspace</span>
        <button data-active={surface === 'sessions' || undefined} type="button">
          <MessageSquare /> Sessions <span>18</span>
        </button>
        <button data-active={surface === 'tickets' || undefined} type="button">
          <Ticket /> Tickets <span>68+</span>
        </button>
        <button type="button">
          <Boxes /> Atlas
        </button>
      </div>
      <div className="global-sidebar__section">
        <span className="section-label">Saved views</span>
        <button type="button">
          <CircleDot /> Open Tickets <span>68+</span>
        </button>
        <button type="button">
          <Bot /> Needs you <span>3</span>
        </button>
        <button type="button">
          <Check /> Recently complete
        </button>
      </div>
      <div className="global-sidebar__space" />
      <footer className="dock-footer">
        <GitBranch /> GitHub · argo
      </footer>
    </aside>
  )
}

function Workbench({ surface }: { surface: Surface }) {
  return (
    <div className="layout layout--b">
      <GlobalSidebar surface={surface} />
      <section className={`local-list local-list--${surface}`}>
        <ListHeader surface={surface} compact />
        <div className="local-list__title">
          <h2>{surface === 'sessions' ? 'Sessions' : 'All open Tickets'}</h2>
          <span>{surface === 'sessions' ? '18' : '68+'}</span>
        </div>
        {surface === 'sessions' ? <SessionList dense /> : <TicketList dense />}
      </section>
      {surface === 'sessions' ? <SessionWorkspace /> : <TicketDetail />}
    </div>
  )
}

function RecallStrip({ surface }: { surface: Surface }) {
  const items = surface === 'sessions' ? sessions.slice(0, 6) : tickets.slice(0, 6)
  return (
    <aside
      className="recall-strip"
      aria-label={surface === 'sessions' ? 'Recent Sessions' : 'Recent Tickets'}
    >
      <ProjectChrome compact />
      <IconButton label={surface === 'sessions' ? 'Find a Session' : 'Find a Ticket'}>
        <Search />
      </IconButton>
      <div className="recall-strip__items">
        {items.map((item, index) => (
          <button
            aria-label={'title' in item ? item.title : ''}
            data-active={index === 0 || undefined}
            key={'title' in item ? item.title : index}
            type="button"
          >
            {surface === 'sessions' ? (
              <>
                <span
                  className={`presence presence--${'state' in item ? item.state.toLowerCase().replaceAll(' ', '-') : ''}`}
                />
                <span>{index + 1}</span>
              </>
            ) : (
              <>
                <CircleDot />
                <span>{'key' in item ? item.key.replace('#', '') : index + 1}</span>
              </>
            )}
          </button>
        ))}
      </div>
      <div className="recall-strip__space" />
      <IconButton label="Show full list">
        <LayoutList />
      </IconButton>
    </aside>
  )
}

function FocusFlow({ surface }: { surface: Surface }) {
  return (
    <div className="layout layout--c">
      <RecallStrip surface={surface} />
      <div className="focus-canvas">
        <div className="focus-canvas__topline">
          <button type="button">
            <ArrowLeft /> {surface === 'sessions' ? 'All Sessions' : 'All Tickets'}
          </button>
          <SearchBar
            placeholder={surface === 'sessions' ? 'Search Sessions…' : 'Search Tickets…'}
          />
        </div>
        {surface === 'sessions' ? <SessionWorkspace roomy /> : <TicketDetail roomy />}
      </div>
    </div>
  )
}

function PrototypeSwitcher({
  variant,
  onVariant,
}: {
  variant: Variant
  onVariant: (variant: Variant) => void
}) {
  const keys = Object.keys(variants) as Variant[]
  const cycle = (offset: number) => {
    const next = keys[(keys.indexOf(variant) + offset + keys.length) % keys.length]
    if (next) onVariant(next)
  }
  return (
    <div className="prototype-switcher">
      <button aria-label="Previous variant" onClick={() => cycle(-1)} type="button">
        <ArrowLeft />
      </button>
      <div>
        <strong>
          {variant} · {variants[variant].name}
        </strong>
        <span>{variants[variant].note}</span>
      </div>
      <button aria-label="Next variant" onClick={() => cycle(1)} type="button">
        <ArrowRight />
      </button>
    </div>
  )
}

function App() {
  const initialVariant = new URLSearchParams(window.location.search).get('variant')
  const [variant, setVariant] = useState<Variant>(
    initialVariant === 'B' || initialVariant === 'C' ? initialVariant : 'A',
  )
  const [surface, setSurface] = useState<Surface>('tickets')
  const selectVariant = useCallback((next: Variant) => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', next)
    window.history.replaceState({}, '', url)
    setVariant(next)
  }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable="true"]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const keys: Variant[] = ['A', 'B', 'C']
      const offset = event.key === 'ArrowLeft' ? -1 : 1
      const next = keys[(keys.indexOf(variant) + offset + keys.length) % keys.length]
      if (next) selectVariant(next)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectVariant, variant])
  const current = useMemo(() => {
    if (variant === 'A') return <ContextDock surface={surface} />
    if (variant === 'B') return <Workbench surface={surface} />
    return <FocusFlow surface={surface} />
  }, [surface, variant])
  return (
    <div className="prototype-app" data-variant={variant}>
      <NavigationRail onSurface={setSurface} surface={surface} />
      {current}
      {import.meta.env.PROD ? null : (
        <PrototypeSwitcher onVariant={selectVariant} variant={variant} />
      )}
    </div>
  )
}

const root = document.getElementById('root')
if (root === null) throw new Error('Ticket layout prototype root is missing.')
createRoot(root).render(<App />)
