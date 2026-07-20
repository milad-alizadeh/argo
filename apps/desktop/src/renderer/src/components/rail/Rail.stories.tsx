import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { STATUS_TONE } from '@/components/ui'
import type { SessionStatus, SessionView } from '@/sessionStore'
import { type RailTone, SESSION_STATES } from '@/ship'
import { Rail } from './Rail'

const meta = {
  title: 'Cockpit/Rail',
  component: Rail,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Rail>

export default meta
type Story = StoryObj<typeof meta>

// Empty hub → empty rail (issue #3): the whole visible surface is the empty state.
export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No Sessions observed yet.')).toBeInTheDocument()
    await expect(canvas.queryByRole('list', { name: 'Sessions' })).not.toBeInTheDocument()
  },
}

const oneSession: SessionView[] = [
  { id: 'demo-claude-1', title: 'Refactor auth module', cli: 'claude', status: 'running' },
]

// A single projected Session → one rail row, asserting the whole visible row.
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

const everyState: SessionView[] = SESSION_STATES.map((status) => ({
  id: status,
  title: `Session ${status}`,
  cli: 'claude',
  status,
}))

// Spelled out rather than read off the table the rows render from — otherwise the story
// only proves nothing falls through, not that the cockpit says what R16 settled on.
const vocabulary: [SessionStatus, string, RailTone][] = [
  ['running', 'Running', 'run'],
  ['needs-input', 'Needs input', 'amber'],
  ['done', 'Done', 'mist'],
  ['failed', 'Failed', 'red'],
  ['queued', 'Queued', 'gray'],
  ['orphaned', 'Orphaned', 'stale'],
]

// Every state main can observe, one row each: each row carries its own word and an icon
// tinted by that word's tone — no state falls through to a blank or a borrowed word.
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
      await expect(row.querySelector('svg')).toHaveClass(STATUS_TONE[tone])
    }
  },
}
