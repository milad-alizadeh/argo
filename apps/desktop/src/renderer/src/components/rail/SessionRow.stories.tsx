import { SESSION_STATES, type SessionStatus, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { SessionView } from '@/sessionStore'
import { SESSION_STATUS } from '@/ship'
import { SessionRow } from './SessionRow'

// The row renders an `<li>`, and `listitem` is only its role inside a list — without the
// parent the stories would assert against a roleless element the rail never renders.
const meta = {
  title: 'Cockpit/SessionRow',
  component: SessionRow,
  argTypes: {
    session: { control: 'object', table: { type: { summary: 'SessionView' } } },
  },
  decorators: [
    (Story) => (
      <ul aria-label="Sessions" className="flex w-60 flex-col gap-snug">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof SessionRow>

export default meta
type Story = StoryObj<typeof meta>

const stateRow = (status: SessionStatus): SessionView => ({
  id: status,
  title: `Session ${status}`,
  cli: 'claude',
  facts: sessionFacts({ status }),
})

/**
 * One observed Session as the rail draws it.
 *
 * Nothing on the row is passed in already rendered: the word, its tone and the leading
 * icon are all graded from `session.facts`, so the facts object is the control worth
 * dragging — change `status`, or hang a `pr` / `ci` off it, and the row re-grades itself.
 */
export const Default: Story = {
  args: {
    session: {
      id: 'auth-refactor',
      title: 'Refactor auth module',
      cli: 'claude',
      facts: sessionFacts({ status: 'running' }),
    },
  },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('listitem')
    await expect(within(row).getByText('Refactor auth module')).toBeInTheDocument()
    await expect(within(row).getByText('claude')).toBeInTheDocument()
    // The word carries the state; the dot beside it is decorative and must stay unnamed.
    await expect(within(row).getByText('Running')).toBeInTheDocument()
    await expect(within(row).queryByRole('img')).not.toBeInTheDocument()
  },
}

/**
 * Every state main can observe, one row each — the visual-diff surface for the row's word,
 * tone and icon in a single frame.
 *
 * Which word each state is owed is settled in `Rail.stories.tsx`, spelled out there against
 * the table; read off `SESSION_STATUS` here so the two files cannot drift apart. What this
 * proves is the row's own job: that it surfaces the graded word in the right row and tints
 * the glyph to match, rather than falling through to a blank or a borrowed one.
 */
export const EveryState: Story = {
  args: { session: stateRow('running') },
  render: () => (
    <>
      {SESSION_STATES.map((status) => (
        <SessionRow key={status} session={stateRow(status)} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole('listitem')
    await expect(rows).toHaveLength(SESSION_STATES.length)
    for (const [index, row] of rows.entries()) {
      const status = SESSION_STATES[index]
      const { word, tone } = SESSION_STATUS[status]
      await expect(within(row).getByText(`Session ${status}`)).toBeInTheDocument()
      await expect(within(row).getByText(word)).toBeInTheDocument()
      await expect(row.querySelector('svg')).toHaveClass(`text-tone-${tone}`)
    }
  },
}
