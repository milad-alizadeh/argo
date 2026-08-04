import { turnFeedRows } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { OPEN_TURN } from '../__fixtures__/interiorTree'
import { TurnFeed } from './TurnFeed'

// Run through the REAL derivation rather than hand-written rows: a story that spells its own rows
// can keep passing after the derivation stops producing them, which is the one thing these stories
// exist to catch. The prose is the interior fixture's, so this surface and the assembled one are
// demonstrably reading the same exchange.
const ROWS = turnFeedRows(OPEN_TURN)
const [PROMPT, QUIET, THOUGHT, MUTATION, MESSAGE] = ROWS

if (!PROMPT || !QUIET || !THOUGHT || !MUTATION || !MESSAGE) {
  throw new Error('the fixture turn must carry the prompt, the fold, the prose and the mutation')
}

// The thought's own disclosure, named rather than found by role: the mutation row's bound carries a
// second collapsed control, and a story that clicked "the collapsed button" would open whichever
// came first.
const thoughtToggle =
  'The legacy module exports verify() and rotate() from one file, and the tests import both from the barrel.'

// The fixture turn's own plan, read off the tree rather than re-typed: the plan row and the left
// pane's tracker must be demonstrably the same list.
const PLAN_ENTRIES = OPEN_TURN.plan?.entries ?? []

const meta = {
  title: 'Sessions/Activity/TurnFeed',
  component: TurnFeed,
  args: { rows: ROWS },
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

/** The whole vocabulary in one frame: the prompt that caused the turn, the evidence folded to a
 * counted line, the reasoning folded to a line, the change it made in the middle of saying it, and
 * the commands it ran after.
 *
 * The reading this frame is judged on is the ORDER: three quiet calls sit directly above the
 * reasoning they justify, and the mutation sits between that reasoning and the answer, where the
 * agent actually made it. */
export const Exchange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Pull the token rotation/)).toBeInTheDocument()
    // Four calls, one line, in counts rather than in a sentence.
    await expect(canvas.getByText('read 2 · searched 1')).toBeInTheDocument()
    await expect(canvas.getByText(/legacy.ts holds two unrelated jobs/)).toBeInTheDocument()
    // Collapsed: the first line is shown, the second is not — and the reasoning is not mistakable
    // for the answer.
    await expect(canvas.getByText(thoughtToggle)).toBeInTheDocument()
    await expect(canvas.queryByText(/every caller breaks at once/)).not.toBeInTheDocument()
    // And the change it made in the middle of saying it, with its diff already on screen.
    await expect(canvas.getByText('edited')).toBeInTheDocument()
    await expect(canvas.getByText(/export class Rotation/)).toBeInTheDocument()
    // The commands: each line shown, the finished one's output behind a click.
    await expect(canvas.getByText('bun run test')).toBeInTheDocument()
    await expect(canvas.getByText('bun run typecheck')).toBeInTheDocument()
    await expect(canvas.queryByText(/Ran 12 tests/)).not.toBeInTheDocument()
  },
}

/** The fold and its break, as short a frame as the rule can be shown in: a run of quiet work, the
 * mutation that ends it, and a second run after — never one label over both. */
export const FoldBrokenByAMutation: Story = {
  args: { rows: [QUIET, MUTATION, QUIET] },
}

/** A command that failed. Its output is already open: the thing that went wrong is the thing you
 * see, and a failure you have to click for is a failure you will miss. */
export const FailedCommand: Story = {
  args: {
    rows: [
      {
        kind: 'call',
        key: 'call:f',
        callKind: 'execute',
        name: 'Bash',
        target: 'bun run typecheck',
        status: 'failed',
        output: { kind: 'output', tier: 'direct', text: 'src/x.ts(4,1): error TS2345' },
        open: true,
      },
      MESSAGE,
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/error TS2345/)).toBeInTheDocument()
  },
}

/** The agent's own to-do list, in the feed at the point it was last revised — one line, and ONE row
 * however many times the turn revised it. The whole list with its marks is the left pane's tracker;
 * drawing it twice on one screen would make a second copy read as a second fact. */
export const ThePlanRow: Story = {
  args: {
    rows: [PROMPT, { kind: 'plan', key: 'plan:now', plan: { entries: PLAN_ENTRIES } }, MESSAGE],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('plan 2 of 4')).toBeInTheDocument()
    await expect(canvas.getByText('· Wire verify() onto it')).toBeInTheDocument()
  },
}

/** The seam where history was condensed, in front of the turn that followed it — so it is visible
 * why earlier context is no longer in the agent's head. Full width, and stitched rather than a gap:
 * the resume chain did not lose the session. */
export const CompactedBefore: Story = {
  args: { rows: [{ kind: 'compaction', key: 'compaction:now' }, PROMPT, MESSAGE] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('compacted')).toBeInTheDocument()
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
