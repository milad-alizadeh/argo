import type { FeedRow } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { TurnFeed } from './TurnFeed'

// The rows a real exchange produces, written as the derivation emits them. Prose an agent would
// actually write, because this is the one surface whose whole job is to be read.
const PROMPT: FeedRow = {
  kind: 'prompt',
  key: 'prompt:t1',
  turnId: 't1',
  text: 'Pull the token rotation out of legacy auth and wire verify() onto it.',
}

const THOUGHT: FeedRow = {
  kind: 'thought',
  key: 'prose:t1:0',
  collapsed: true,
  markdown:
    'The tests import verify() and rotate() from the same barrel.\nSo the extraction has to keep re-exporting both, or every caller breaks at once.',
}

const MESSAGE: FeedRow = {
  kind: 'message',
  key: 'prose:t1:1',
  markdown:
    'Rotation now lives in its own module, and the old barrel re-exports it so nothing downstream changes yet.\n\nverify() takes the rotation as an argument rather than reaching for the module-level key — that is what made it untestable.',
}

const meta = {
  title: 'Sessions/Activity/TurnFeed',
  component: TurnFeed,
  args: { rows: [PROMPT, THOUGHT, MESSAGE] },
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
 * folded to a line, and the answer at full strength. */
export const Exchange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Pull the token rotation/)).toBeInTheDocument()
    await expect(canvas.getByText(/Rotation now lives/)).toBeInTheDocument()
    // Collapsed: the first line is shown, the second is not — and the reasoning is not mistakable
    // for the answer.
    await expect(canvas.getByRole('button', { expanded: false })).toBeInTheDocument()
    await expect(canvas.queryByText(/every caller breaks at once/)).not.toBeInTheDocument()
  },
}

/** A thought opened on demand, which is the only way its full text is ever shown. */
export const ThoughtOpened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { expanded: false }))
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

/** Prose is rendered as PLAIN TEXT: whitespace is kept and markup is shown as the characters the
 * model wrote, never interpreted (markdown-lite is issue 315) and never injected as HTML. */
export const VerbatimProse: Story = {
  args: {
    rows: [
      {
        kind: 'message',
        key: 'prose:t2:0',
        markdown:
          'Indented block:\n\n    const rail = "#rail"\n    // two spaces after this ->  \n\n**not bold**, <b>not html</b>, and a `code span` that stays punctuation.',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/not bold/)).toBeInTheDocument()
    // The tag is text, not an element: nothing in the feed may become markup.
    await expect(canvasElement.querySelector('b')).toBeNull()
  },
}

/** A turn the record carries nothing for at all. Rare, and it says so rather than rendering an empty
 * section that reads as a loading state. */
export const Empty: Story = { args: { rows: [] } }
