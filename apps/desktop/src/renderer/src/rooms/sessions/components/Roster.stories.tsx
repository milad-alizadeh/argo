import { type SessionView, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { buildSessionsRoomModel } from '../sessionsRoomModel'
import { Roster } from './Roster'

const HEAD = 'a1b2c3d'

const session = (over: Partial<SessionView> & { id: string }): SessionView => ({
  title: `Session ${over.id}`,
  cli: 'claude',
  cwd: null,
  model: 'claude-opus-4',
  branch: 'feat/auth-rotation',
  lastActivityAt: null,
  projectId: null,
  posture: 'managed',
  agents: [],
  facts: sessionFacts(),
  ...over,
})

const POPULATED: readonly SessionView[] = [
  session({ id: 'auth', title: 'Refactor auth module', lastActivityAt: 4_000 }),
  session({
    id: 'flaky',
    title: 'Why is CI flaky',
    model: 'gpt-5',
    branch: 'fix/ci-flake',
    lastActivityAt: 3_000,
    facts: sessionFacts({ status: 'asking' }),
  }),
  session({
    id: 'hero',
    title: 'Landing hero',
    branch: 'feat/landing-hero',
    lastActivityAt: 2_000,
    facts: sessionFacts({ status: 'idle' }),
  }),
  session({
    id: 'watched',
    title: 'Someone else’s session',
    posture: 'external',
    model: null,
    cwd: '/Users/dev/other-repo',
    lastActivityAt: 1_000,
  }),
]

const ARCHIVED: readonly SessionView[] = [
  ...POPULATED,
  session({
    id: 'landed',
    title: 'Release notes',
    lastActivityAt: 500,
    facts: sessionFacts({ headSha: HEAD, pr: { num: 38, state: 'merged', base: 'main' } }),
  }),
]

const meta = {
  title: 'Sessions/Roster',
  component: Roster,
  parameters: { layout: 'fullscreen' },
  args: { onSelectSession: fn(), onSpawnSession: fn() },
  argTypes: {
    model: {
      control: false,
      description:
        "The rail's derived view-model: the live rows in render order, the archived ones and their count. A derivation rather than raw state, so there is nothing here to edit by hand.",
      table: { type: { summary: 'SessionsRoomModel' } },
    },
  },
  // The rail sits directly on the room's lit scene — its rows are planes, so a panel behind them
  // would be glass on glass. The decorator supplies the scene and pins the splitter's `--c-rail`.
  decorators: [
    (Story) => (
      <div
        className="flex h-screen w-screen bg-background text-foreground"
        style={{ '--c-rail': '300px' } as React.CSSProperties}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Roster>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The populated rail: `+ New session` pinned at the top, then one plane per session in
 * most-recent-first order, each reading `dot · name · word` over `model · branch`.
 */
export const Populated: Story = {
  args: { model: buildSessionsRoomModel({ sessions: POPULATED }) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('list', { name: 'Sessions' })
    const rows = within(list).getAllByRole('listitem')
    await expect(rows.map((row) => row.textContent)).toEqual([
      'Refactor auth modulerunningclaude-opus-4·feat/auth-rotation',
      'Why is CI flakyneeds yougpt-5·fix/ci-flake',
      'Landing heroidleclaude-opus-4·feat/landing-hero',
      'Someone else’s sessionread-onlyunknown·/Users/dev/other-repo',
    ])
    await userEvent.click(within(list).getByText('Landing hero'))
    await expect(args.onSelectSession).toHaveBeenCalledWith('hero')
  },
}

/** The selected row is the one that brightens, and the only one — nothing else in the rail moves. */
export const Selected: Story = {
  args: { model: buildSessionsRoomModel({ sessions: POPULATED, selectedId: 'flaky' }) },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Sessions' })
    const current = within(list).getAllByRole('button', { current: true })
    await expect(current).toHaveLength(1)
    await expect(current[0]).toHaveTextContent('Why is CI flaky')
  },
}

/**
 * The zero-state is JUST the `+ New session` row: no hero, no illustration, no onboarding copy — a
 * one-time transient costs no permanent chrome. There is no session list at all to find.
 */
export const Zero: Story = {
  args: { model: buildSessionsRoomModel({ sessions: [] }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'New session' })).toBeInTheDocument()
    await expect(canvas.queryByRole('list')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /Archived/ })).not.toBeInTheDocument()
  },
}

/**
 * A merged session has left the live rail by itself and is counted at the foot. The footer opens the
 * archived list; it archives nothing, because archiving is a status transition and not a button.
 */
export const ArchivedOpen: Story = {
  args: { model: buildSessionsRoomModel({ sessions: ARCHIVED }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const live = canvas.getByRole('list', { name: 'Sessions' })
    await expect(within(live).getAllByRole('listitem')).toHaveLength(POPULATED.length)
    const footer = canvas.getByRole('button', { name: 'Archived (1)' })
    await userEvent.click(footer)
    const archived = canvas.getByRole('list', { name: 'Archived sessions' })
    await expect(within(archived).getByText('Release notes')).toBeInTheDocument()
    await expect(within(archived).getByText('merged')).toBeInTheDocument()
  },
}
