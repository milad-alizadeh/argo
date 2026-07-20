import { SESSION_STATES, type SessionStatus, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { SessionView } from '@/sessionStore'
import type { RailTone } from '@/shared/ship'
import { Rail } from './Rail'

const meta = {
  title: 'Rail',
  component: Rail,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    sessions: {
      control: false,
      description:
        'The projected Sessions the rail renders, one row each, already carrying the facts a row derives its word and tone from. A projection rather than raw state, so there is nothing here to edit by hand.',
      table: { type: { summary: 'SessionView[]' } },
    },
  },
} satisfies Meta<typeof Rail>

export default meta
type Story = StoryObj<typeof meta>

/** Empty hub → empty rail (issue #3): the whole visible surface is the empty state. */
export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
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

/** A single projected Session → one rail row, asserting the whole visible row. */
export const SingleSession: Story = {
  args: { sessions: oneSession },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('list', { name: 'Sessions' })
    await expect(within(list).getByText('Refactor auth module')).toBeInTheDocument()
    await expect(within(list).getByText('claude')).toBeInTheDocument()
    // The visible status word carries the status (the dot beside it is decorative).
    await expect(within(list).getByText('Running')).toBeInTheDocument()
    await expect(canvas.queryByText('No Sessions observed yet.')).not.toBeInTheDocument()
  },
}

// A clean tree with no commits grows no ribbon (R7), so every row falls back to the
// Session's own triage word — one row per state main can observe.
const everyState: SessionView[] = SESSION_STATES.map((status) => ({
  id: status,
  title: `Session ${status}`,
  cli: 'claude',
  facts: sessionFacts({ status }),
}))

// Spelled out rather than read off the table the rows render from — otherwise the story
// only proves nothing falls through, not that the cockpit says what R16 settled on.
const vocabulary: [SessionStatus, string, RailTone][] = [
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
const shipStates: SessionView[] = [
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
 * The ribbon-derived half of R16, reachable now that facts cross the bridge: a ship stage
 * REPLACES the lifecycle word rather than appending a detail to it.
 */
export const ShipStates: Story = {
  args: { sessions: shipStates },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('list', { name: 'Sessions' })
    for (const word of ['CI failing', 'Ready to merge', 'Commit ready']) {
      await expect(within(list).getByText(word)).toBeInTheDocument()
    }
    await expect(within(list).queryByText('Running')).not.toBeInTheDocument()
  },
}
