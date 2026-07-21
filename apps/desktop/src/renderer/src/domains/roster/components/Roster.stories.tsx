import { SESSION_STATES, type SessionStatus, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import type { SessionView } from '@/sessionStore'
import type { RosterTone } from '@/shared/delivery'
import { Roster } from './Roster'

const meta = {
  title: 'Roster',
  component: Roster,
  parameters: { layout: 'fullscreen' },
  // The roster is the spine's left column; its old `<main>` window moved to SessionScreen. This
  // decorator replays that window, pinning `--c-rail` to the splitter's 300px initial so the
  // panel sizes exactly as it does in the app.
  decorators: [
    (Story) => (
      <div
        className="flex h-screen w-screen bg-background p-3 text-foreground"
        style={{ '--c-rail': '300px' } as React.CSSProperties}
      >
        <Story />
      </div>
    ),
  ],
  argTypes: {
    sessions: {
      control: false,
      description:
        'The projected Sessions the roster renders, one row each, already carrying the facts a row derives its word and tone from. A projection rather than raw state, so there is nothing here to edit by hand.',
      table: { type: { summary: 'SessionView[]' } },
    },
  },
} satisfies Meta<typeof Roster>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Empty hub → empty roster: the Projects header and its "+" persist, and the empty state folds
 * into the panel body rather than swapping the whole panel. There is no project group to open
 * when nothing has been observed.
 */
export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Projects')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'New session' })).toBeInTheDocument()
    await expect(canvas.getByText('No Sessions observed yet.')).toBeInTheDocument()
    await expect(canvas.queryByRole('list', { name: 'Sessions' })).not.toBeInTheDocument()
  },
}

const oneSession: SessionView[] = [
  {
    id: 'demo-claude-1',
    title: 'Refactor auth module',
    cli: 'claude',
    facts: sessionFacts({ status: 'running' }),
  },
]

/**
 * A single projected Session → one roster row under the Projects header and the collapsible
 * "argo" project group, asserting the whole visible frame.
 */
export const SingleSession: Story = {
  args: { sessions: oneSession },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Projects')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'argo' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(canvas.getByRole('button', { name: 'New session in argo' })).toBeInTheDocument()
    const list = canvas.getByRole('list', { name: 'Sessions' })
    await expect(within(list).getByText('Refactor auth module')).toBeInTheDocument()
    await expect(within(list).getByText('claude')).toBeInTheDocument()
    // The visible status word carries the status (the dot beside it is decorative).
    await expect(within(list).getByText('Running')).toBeInTheDocument()
    await expect(canvas.queryByText('No Sessions observed yet.')).not.toBeInTheDocument()
  },
}

/**
 * The project group's own state: clicking the "argo" row collapses it, and the rows in the
 * scroll region unmount — the header chrome stays put. (Open is the base story's default.)
 */
export const CollapsedGroup: Story = {
  args: { sessions: oneSession },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'argo' })
    await expect(canvas.getByRole('list', { name: 'Sessions' })).toBeInTheDocument()
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('list', { name: 'Sessions' })).not.toBeInTheDocument()
    // The header survives the collapse — it is not part of the group.
    await expect(canvas.getByText('Projects')).toBeInTheDocument()
  },
}

// A clean tree with no commits grows no lifecycle (R7), so every row falls back to the
// Session's own triage word — one row per state main can observe.
const everyState: SessionView[] = SESSION_STATES.map((status) => ({
  id: status,
  title: `Session ${status}`,
  cli: 'claude',
  facts: sessionFacts({ status }),
}))

// Spelled out rather than read off the table the rows render from — otherwise the story
// only proves nothing falls through, not that the cockpit says what R16 settled on.
const vocabulary: [SessionStatus, string, RosterTone][] = [
  ['running', 'Running', 'run'],
  ['needs-input', 'Needs input', 'amber'],
  ['done', 'Done', 'done'],
  ['failed', 'Failed', 'red'],
  ['queued', 'Queued', 'gray'],
  ['orphaned', 'Orphaned', 'stale'],
]

/**
 * Every state main can observe, one row each: each row carries its own word and an icon
 * tinted by that word's tone — no state falls through to a blank or a borrowed word.
 */
export const EveryState: Story = {
  args: { sessions: everyState },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Sessions' })
    const rows = within(list).getAllByRole('listitem')
    await expect(rows).toHaveLength(vocabulary.length)
    await expect(SESSION_STATES).toEqual(vocabulary.map(([status]) => status))
    for (const [index, row] of rows.entries()) {
      const [, word, tone] = vocabulary[index]
      await expect(within(row).getByText(word)).toBeInTheDocument()
      await expect(row.querySelector('svg')).toHaveClass(`text-tone-${tone}`)
    }
  },
}

const HEAD = 'a1b2c3d'
const PR = { num: 42, state: 'open', base: 'main' } as const

// All three are `status: 'running'`; none of them says "Running".
const deliveryStates: SessionView[] = [
  {
    id: 'ci-failing',
    title: 'Why is CI flaky',
    cli: 'claude',
    facts: sessionFacts({ headSha: HEAD, pr: PR, ci: { status: 'failed', sha: HEAD } }),
  },
  {
    id: 'ready-to-merge',
    title: 'Voice input spike',
    cli: 'codex',
    facts: sessionFacts({
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'approved', sha: HEAD, findings: 0 }],
    }),
  },
  {
    id: 'commit-ready',
    title: 'Auth refactor',
    cli: 'claude',
    facts: sessionFacts({ headSha: HEAD, dirty: 3, agent: 'idle' }),
  },
]

/**
 * The lifecycle-derived half of R16, reachable now that facts cross the bridge: a delivery stage
 * REPLACES the lifecycle word rather than appending a detail to it.
 */
export const DeliveryStates: Story = {
  args: { sessions: deliveryStates },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Sessions' })
    for (const word of ['CI failing', 'Ready to merge', 'Commit ready']) {
      await expect(within(list).getByText(word)).toBeInTheDocument()
    }
    await expect(within(list).queryByText('Running')).not.toBeInTheDocument()
  },
}

// One amber row and one running row, nothing selected → the lifecycle is quiet, so the roster
// spends the screen's one pulse budget on the top needs-you (amber) dot.
const needsYou: SessionView[] = [
  {
    id: 'running',
    title: 'Refactor auth module',
    cli: 'claude',
    facts: sessionFacts({ status: 'running' }),
  },
  {
    id: 'needs-input',
    title: 'Voice input spike',
    cli: 'codex',
    facts: sessionFacts({ status: 'needs-input' }),
  },
]

// The dot lives one level below the Status word span; the same `span > span` the Status story
// reads. A row with no pulse leaves its dot's `animationName` at `none`.
const dotAnimation = (row: Element | null): string =>
  getComputedStyle(row?.querySelector('span > span') as Element).animationName

/**
 * The needs-you pulse: the top amber row's dot animates while every other dot stays static, so
 * exactly one element carries the budget.
 */
export const NeedsYouPulse: Story = {
  args: { sessions: needsYou },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const amberRow = canvas.getByText('Voice input spike').closest('li')
    const runningRow = canvas.getByText('Refactor auth module').closest('li')
    await expect(dotAnimation(amberRow)).toBe('pulse-status')
    await expect(dotAnimation(runningRow)).toBe('none')
  },
}

// A single amber row that is ALSO the selected Session, stalled on `commits:gate` — the exact
// head state the Delivery strip pulses on.
const commitReady: SessionView[] = [
  {
    id: 'commit-ready',
    title: 'Auth refactor',
    cli: 'claude',
    facts: sessionFacts({ headSha: HEAD, dirty: 3, agent: 'idle' }),
  },
]

/**
 * The pulse yields to the lifecycle: when the selected Session's head node is itself blocked,
 * the Delivery strip owns the budget and no roster dot pulses — the two surfaces never animate
 * at once.
 */
export const PulseYieldsToLifecycle: Story = {
  args: { sessions: commitReady, selectedId: 'commit-ready' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // It is still the amber needs-you row…
    await expect(canvas.getByText('Commit ready')).toBeInTheDocument()
    // …but its dot is static, because the selected lifecycle is hot.
    await expect(dotAnimation(canvas.getByText('Auth refactor').closest('li'))).toBe('none')
  },
}
