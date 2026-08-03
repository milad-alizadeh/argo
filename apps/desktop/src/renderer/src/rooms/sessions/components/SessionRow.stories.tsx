import { type SessionView, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { buildSessionsRoomModel, type RosterRow } from '../sessionsRoomModel'
import { SessionRow } from './SessionRow'

// The row renders an `<li>`, and `listitem` is only its role inside a list — without the parent the
// stories would assert against a roleless element the rail never renders.
const meta = {
  title: 'Sessions/Roster/SessionRow',
  component: SessionRow,
  args: { onSelect: fn() },
  argTypes: {
    row: { control: 'object', table: { type: { summary: 'RosterRow' } } },
  },
  decorators: [
    (Story) => (
      <div className="w-80 bg-background p-inset">
        <ul aria-label="Sessions" className="flex flex-col gap-gap">
          <Story />
        </ul>
      </div>
    ),
  ],
} satisfies Meta<typeof SessionRow>

export default meta
type Story = StoryObj<typeof meta>

const HEAD = 'a1b2c3d'

const session = (over: Partial<SessionView> & { id: string }): SessionView => ({
  title: 'Refactor auth module',
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

// Rows are never hand-written: they come off the same derivation the app renders, so a story cannot
// spell a word the model would not produce.
const rowOf = (one: SessionView, selectedId: string | null = null): RosterRow => {
  const [row] = buildSessionsRoomModel({ sessions: [one], selectedId }).rows
  if (row === undefined) throw new Error(`${one.id} left the live rail`)
  return row
}

/**
 * One session as the rail draws it: `dot · name · word` over `model · branch`, the word cased by
 * the eyebrow role rather than in TS, and no ctx anywhere — that is per-session detail the header
 * carries, never something you compare across rows.
 */
export const Running: Story = {
  args: { row: rowOf(session({ id: 'auth' })) },
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByText('Refactor auth module')).toBeInTheDocument()
    await expect(within(row).getByText('running')).toBeInTheDocument()
    await expect(within(row).getByText('claude-opus-4')).toBeInTheDocument()
    await expect(within(row).getByText('feat/auth-rotation')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button'))
    await expect(args.onSelect).toHaveBeenCalledWith('auth')
  },
}

/** The selected row: the plane brightens, and that is the ONLY thing selection changes. */
export const Selected: Story = {
  args: { row: rowOf(session({ id: 'auth' }), 'auth') },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByRole('button')).toHaveAttribute('aria-current', 'true')
  },
}

/**
 * A session Argo only observes: ghosted, hollow dot, no state word — its status degrades away
 * rather than being faked — and its working PATH in place of a branch, because Argo did not create
 * that checkout.
 */
export const External: Story = {
  args: {
    row: rowOf(
      session({
        id: 'watched',
        title: 'Someone else’s session',
        posture: 'external',
        model: null,
        cwd: '/Users/dev/other-repo',
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByText('read-only')).toBeInTheDocument()
    await expect(within(row).getByText('/Users/dev/other-repo')).toBeInTheDocument()
    // A fact nobody reported reads `unknown`, never a default model.
    await expect(within(row).getByText('unknown')).toBeInTheDocument()
  },
}

/**
 * The one row asking for you: its dot burns gold and breathes, and a faint ray of the same gold
 * travels the plane's ring — the rail's one rationed animation, and the only thing state is
 * allowed to add to a plane.
 */
export const NeedsYou: Story = {
  args: {
    row: rowOf(
      session({
        id: 'perms',
        title: 'Rotate the deploy key',
        facts: sessionFacts({ status: 'asking' }),
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByText('needs you')).toBeInTheDocument()
    const plane = within(row).getByRole('button')
    await expect(plane).toHaveClass('sweep')
    // Asserting the computed animation, not the class: an unregistered `--sweep-angle` leaves the
    // ring lit but parked, which is the failure a class check cannot see.
    await expect(getComputedStyle(plane, '::before').animationName).toBe('sweep-travel')
  },
}

/**
 * A delivery claim outranks the session's own liveness: this row is `status: running` and says
 * `CI failed`, because that is the one decision-relevant word.
 */
export const DeliveryClaim: Story = {
  args: {
    row: rowOf(
      session({
        id: 'ci',
        title: 'Why is CI flaky',
        facts: sessionFacts({
          headSha: HEAD,
          pr: { num: 42, state: 'open', base: 'main' },
          ci: { status: 'failed', sha: HEAD },
        }),
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByText('CI failed')).toBeInTheDocument()
    await expect(within(row).queryByText('running')).not.toBeInTheDocument()
  },
}

const DOT_STATES: readonly SessionView[] = [
  session({ id: 'running', title: 'Running' }),
  session({ id: 'asking', title: 'Needs you', facts: sessionFacts({ status: 'asking' }) }),
  session({ id: 'stopped', title: 'Failed', facts: sessionFacts({ status: 'stopped' }) }),
  session({ id: 'idle', title: 'Idle', facts: sessionFacts({ status: 'idle' }) }),
  session({ id: 'external', title: 'External', posture: 'external', cwd: '/w/theirs' }),
]

/**
 * Every dot the rail can draw, stacked as the rail stacks them: running green and needs-you gold
 * lit and breathing, then failed red lit but still, an idle grey holding quiet, and a hollow
 * external ring. Exactly one plane carries the sweep, which is how "one thing shouting" is judged.
 */
export const EveryDot: Story = {
  args: { row: rowOf(session({ id: 'auth' })) },
  render: () => (
    <>
      {DOT_STATES.map((one) => (
        <SessionRow key={one.id} row={rowOf(one)} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole('listitem')
    await expect(rows).toHaveLength(DOT_STATES.length)
    for (const [index, row] of rows.entries()) {
      const { dot } = rowOf(DOT_STATES[index])
      await expect(row.querySelector('span')).toHaveClass(`text-tone-${dot.tone}`)
    }
    await expect(canvasElement.querySelectorAll('.sweep')).toHaveLength(1)
  },
}
