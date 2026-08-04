import { turnFeedRows } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { OPEN_TURN } from '../__fixtures__/interiorTree'
import { TurnFeed } from './TurnFeed'

// Run through the REAL derivation rather than hand-written rows: a story that spells its own rows
// can keep passing after the derivation stops producing them, which is the one thing these stories
// exist to catch. The prose is the interior fixture's, so this surface and the assembled one are
// demonstrably reading the same exchange.
const [PROMPT, THOUGHT, MUTATION, MESSAGE] = turnFeedRows(OPEN_TURN)

if (!PROMPT || !THOUGHT || !MUTATION || !MESSAGE) {
  throw new Error('the fixture turn must carry all four rows')
}

// The thought's own disclosure, named rather than found by role: the mutation row's bound carries a
// second collapsed control, and a story that clicked "the collapsed button" would open whichever
// came first.
const thoughtToggle =
  'The legacy module exports verify() and rotate() from one file, and the tests import both from the barrel.'

const meta = {
  title: 'Sessions/Activity/TurnFeed',
  component: TurnFeed,
  args: { rows: [PROMPT, THOUGHT, MUTATION, MESSAGE] },
  argTypes: { rows: { control: false, table: { type: { summary: 'FeedRow[]' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TurnFeed>

export default meta
type Story = StoryObj<typeof meta>

/** The whole vocabulary of this ticket in one frame: the prompt that caused the turn, the reasoning
 * folded to a line, and the answer it went on to give. */
export const Exchange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Pull the token rotation/)).toBeInTheDocument()
    await expect(canvas.getByText(/legacy.ts holds two unrelated jobs/)).toBeInTheDocument()
    // Collapsed: the first line is shown, the second is not — and the reasoning is not mistakable
    // for the answer.
    await expect(canvas.getByText(thoughtToggle)).toBeInTheDocument()
    await expect(canvas.queryByText(/every caller breaks at once/)).not.toBeInTheDocument()
    // And the change it made in the middle of saying it, with its diff already on screen.
    await expect(canvas.getByText('edited')).toBeInTheDocument()
    await expect(canvas.getByText(/export class Rotation/)).toBeInTheDocument()
  },
}

/** A thought opened on demand, which is the only way its full text is ever shown. */
export const ThoughtOpened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText(thoughtToggle))
    await expect(canvas.getByText(/every caller breaks at once/)).toBeInTheDocument()
  },
}

/** An agent that answered without visible reasoning — the ordinary case, and the one a feed built
 * around a thought row would render badly. */
export const NoThought: Story = { args: { rows: [PROMPT, MESSAGE] } }

/** A turn still working: the prompt landed, nothing has been said back yet. The section shows the
 * cause rather than going blank, so the work below has a stated reason from the first frame. */
export const PromptOnly: Story = {
  args: { rows: [PROMPT] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}

/** Which rows read as markdown: the agent's do, the prompt's does not. The prompt is the human's
 * typed text and never carried markup intent, so its asterisks stay asterisks while the message
 * beneath sets the same characters as emphasis. The subset itself is `Prose`'s to story. */
export const PromptIsNotMarkdown: Story = {
  args: {
    rows: [
      { kind: 'prompt', key: 'prompt:t2', text: 'rename **rail** in `#list`', turnId: 't2' },
      { kind: 'message', key: 'prose:t2:0', markdown: 'renamed **rail** in `#list`' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/rename \*\*rail\*\* in `#list`/)).toBeInTheDocument()
    await expect(canvas.getByText('rail')).toBeInTheDocument()
  },
}

/** A turn the record carries nothing for at all. Rare, and it says so rather than rendering an empty
 * section that reads as a loading state. */
export const Empty: Story = { args: { rows: [] } }
