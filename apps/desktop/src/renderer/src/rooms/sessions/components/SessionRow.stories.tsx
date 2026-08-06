import { type SessionView, sessionFacts, sessionView } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { buildSessionsRoomModel, type RosterRow } from '../roster/model'
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
const OLD = '9f0e1d2'
const PR = { num: 42, state: 'open', base: 'main' } as const

// A session Argo drives, which is what every row here is bar the external one. Only the facts a
// story is actually about get spelled out.
const driven = (over: Partial<SessionView> & { id: string }): SessionView =>
  sessionView({ model: 'claude-opus-4', branch: 'feat/auth-rotation', ...over })

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
  args: { row: rowOf(driven({ id: 'auth', title: 'Refactor auth module' })) },
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
  args: { row: rowOf(driven({ id: 'auth', title: 'Refactor auth module' }), 'auth') },
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
      sessionView({
        id: 'watched',
        title: 'Someone else’s session',
        posture: 'external',
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
 * A row asking for you: its dot burns gold and breathes, and a faint ray of the same gold travels
 * the plane's ring — the rail's one rationed animation, and the only thing state is allowed to add
 * to a plane.
 */
export const NeedsYou: Story = {
  args: {
    row: rowOf(
      driven({
        id: 'perms',
        title: 'Rotate the deploy key',
        branch: 'feat/key-rotation',
        facts: sessionFacts({ status: 'asking' }),
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByText('needs you')).toBeInTheDocument()
    // Asserting the computed animation rather than a class: an unregistered `--sweep-angle` leaves
    // the ring lit but parked, which is the failure a class check cannot see.
    const plane = within(row).getByRole('button')
    await expect(getComputedStyle(plane, '::before').animationName).toBe('sweep-travel')
  },
}

/**
 * A delivery claim outranks the session's own liveness: this row is `status: running` and reads
 * `CI failed`, because that is the one decision-relevant word — and the dot follows THE WORD, so it
 * is red and at rest rather than the green of the session underneath. No sweep: a failed check is
 * not going to change until you act, and motion is reserved for what is still moving.
 */
export const CiFailed: Story = {
  args: {
    row: rowOf(
      driven({
        id: 'ci',
        title: 'Why is CI flaky',
        branch: 'fix/ci-flake',
        facts: sessionFacts({ headSha: HEAD, pr: PR, ci: { status: 'failed', sha: HEAD } }),
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByText('CI failed')).toBeInTheDocument()
    await expect(within(row).queryByText('running')).not.toBeInTheDocument()
    const plane = within(row).getByRole('button')
    await expect(getComputedStyle(plane, '::before').animationName).not.toBe('sweep-travel')
  },
}

/**
 * The other half of the same claim, and the state nothing rendered before: a check that no longer
 * speaks for the head commit locks the Merge node, so the row reads `blocked`. That is a needs-input
 * word, which means it earns the gold dot AND the attention sweep exactly as a permission prompt
 * does — attention is attention wherever in the session it came from.
 */
export const Blocked: Story = {
  args: {
    row: rowOf(
      driven({
        id: 'stale',
        title: 'Split the observer',
        branch: 'refactor/observer',
        facts: sessionFacts({ headSha: HEAD, pr: PR, ci: { status: 'passed', sha: OLD } }),
      }),
    ),
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByText('blocked')).toBeInTheDocument()
    const plane = within(row).getByRole('button')
    await expect(getComputedStyle(plane, '::before').animationName).toBe('sweep-travel')
  },
}
