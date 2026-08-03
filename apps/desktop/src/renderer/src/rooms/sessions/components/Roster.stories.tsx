import { type SessionView, sessionFacts, sessionView } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { buildSessionsRoomModel } from '../sessionsRoomModel'
import { Roster } from './Roster'

const HEAD = 'a1b2c3d'
const OLD = '9f0e1d2'
const PR = { num: 42, state: 'open', base: 'main' } as const

const POPULATED: readonly SessionView[] = [
  sessionView({
    id: 'auth',
    title: 'Refactor auth module',
    model: 'claude-opus-4',
    branch: 'feat/auth-rotation',
    lastActivityAt: 6_000,
  }),
  sessionView({
    id: 'flaky',
    title: 'Why is CI flaky',
    model: 'gpt-5',
    branch: 'fix/ci-flake',
    lastActivityAt: 5_000,
    facts: sessionFacts({ status: 'asking' }),
  }),
  sessionView({
    id: 'checks',
    title: 'Rotate the deploy key',
    model: 'claude-opus-4',
    branch: 'feat/key-rotation',
    lastActivityAt: 4_000,
    facts: sessionFacts({ headSha: HEAD, pr: PR, ci: { status: 'failed', sha: HEAD } }),
  }),
  sessionView({
    id: 'stale',
    title: 'Split the observer',
    model: 'claude-opus-4',
    branch: 'refactor/observer',
    lastActivityAt: 3_000,
    facts: sessionFacts({ headSha: HEAD, pr: PR, ci: { status: 'passed', sha: OLD } }),
  }),
  sessionView({
    id: 'hero',
    title: 'Landing hero',
    model: 'claude-opus-4',
    branch: 'feat/landing-hero',
    lastActivityAt: 2_000,
    facts: sessionFacts({ status: 'idle' }),
  }),
  sessionView({
    id: 'watched',
    title: 'Someone else’s session',
    posture: 'external',
    cwd: '/Users/dev/other-repo',
    lastActivityAt: 1_000,
  }),
]

const ARCHIVED: readonly SessionView[] = [
  ...POPULATED,
  sessionView({
    id: 'landed',
    title: 'Release notes',
    model: 'claude-opus-4',
    branch: 'chore/release-notes',
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
        style={{ '--c-rail': '300px' }}
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
 * most-recent-first order, each reading `dot · name · word` over `model · branch`. This is where the
 * whole read is judged — the two rows asking for you carry the gold sweep (a permission prompt, and
 * a delivery locked by a check that no longer speaks for its commit), the failed check burns red and
 * holds still, and the rest stay quiet.
 */
export const Populated: Story = {
  args: { model: buildSessionsRoomModel({ sessions: POPULATED }) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('list', { name: 'Sessions' })
    const rows = within(list).getAllByRole('listitem')
    // Order is the model's claim, asserted as arithmetic in `sessionsRoomModel.test.ts`; the story
    // only proves it reached the screen intact — each row by the name and the one word a person reads.
    const railed: [string, string][] = [
      ['Refactor auth module', 'running'],
      ['Why is CI flaky', 'needs you'],
      ['Rotate the deploy key', 'CI failed'],
      ['Split the observer', 'blocked'],
      ['Landing hero', 'idle'],
      ['Someone else’s session', 'read-only'],
    ]
    await expect(rows).toHaveLength(railed.length)
    for (const [index, [name, word]] of railed.entries()) {
      const row = within(rows[index] ?? canvasElement)
      await expect(row.getByText(name)).toBeInTheDocument()
      await expect(row.getByText(word)).toBeInTheDocument()
    }
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
 * A landed session has left the live rail by itself and is counted at the foot. The footer opens the
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
    await expect(within(archived).getByText('landed')).toBeInTheDocument()
  },
}
