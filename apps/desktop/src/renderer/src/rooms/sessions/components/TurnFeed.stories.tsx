import type { FeedRow } from '@shared'
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

/** One row of a kind, found BY kind rather than by position: the fixture's rows move whenever it
 * gains a call, and a story keyed to an index would then silently frame the wrong row. */
function rowOfKind<K extends FeedRow['kind']>(kind: K): Extract<FeedRow, { kind: K }> {
  const row = ROWS.find(
    (candidate): candidate is Extract<FeedRow, { kind: K }> => candidate.kind === kind,
  )
  if (row === undefined) throw new Error(`the fixture turn must carry a ${kind} row`)
  return row
}

const PROMPT = rowOfKind('prompt')
const QUIET = rowOfKind('quiet')
const MUTATION = rowOfKind('mutation')
const MESSAGE = rowOfKind('message')

// The thought's own disclosure, named rather than found by role: the mutation row's bound carries a
// second collapsed control, and a story that clicked "the collapsed button" would open whichever
// came first.
const thoughtToggle =
  'The legacy module exports verify() and rotate() from one file, and the tests import both from the barrel.'

// The other two loud rows, for the break frame below. Written out rather than pulled from the
// fixture because what that frame needs is a SEQUENCE the fixture does not contain — the rows
// themselves are the child stories' to judge.
const COMMAND: FeedRow = {
  kind: 'call',
  key: 'call:ran',
  callKind: 'execute',
  name: 'Bash',
  target: 'bun run test',
  status: 'completed',
  output: null,
}

const FAILED_CALL: FeedRow = { ...COMMAND, key: 'call:failed', status: 'failed' }

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
    // Three calls, one line, in counts rather than in a sentence.
    await expect(canvas.getByText('Read 2 · Searched 1')).toBeInTheDocument()
    // And the plan it wrote in the same breath, stated in a line where the revision happened.
    await expect(canvas.getByText('plan 2 of 4')).toBeInTheDocument()
    await expect(canvas.getByText(/legacy.ts holds two unrelated jobs/)).toBeInTheDocument()
    // Collapsed: the first line is shown, the second is not — and the reasoning is not mistakable
    // for the answer.
    await expect(canvas.getByText(thoughtToggle)).toBeInTheDocument()
    await expect(canvas.queryByText(/every caller breaks at once/)).not.toBeInTheDocument()
    // And the change it made in the middle of saying it — the row on screen, its patch behind the
    // same caret every other row's body sits behind, because a column of open diffs is a wall of
    // code with the prose that explains it lost between the walls.
    await expect(canvas.getByText('Edit')).toBeInTheDocument()
    await expect(canvasElement.textContent).not.toContain('export class Rotation')
    // The commands: each line on screen, and every result behind its own caret whatever its length.
    // A column whose row heights depend on how much each call happened to print is one you cannot
    // skim, and skimming is the whole job of this surface.
    await expect(canvas.getByText('bun run test')).toBeInTheDocument()
    await expect(canvas.getByText('bun run typecheck')).toBeInTheDocument()
    await expect(canvas.queryByText(/Ran 12 tests/)).not.toBeInTheDocument()
  },
}

/**
 * The BREAK, at each of the three loud kinds — a run of quiet work, the loud row that ends it, and a
 * second run after. What the frame proves is that no label ever spans both: this is the rule that
 * makes "edited a file, ran a command, read a file" mush structurally impossible.
 *
 * A composed frame rather than three of the child's, because the break is not a row's property — it
 * is what happens BETWEEN rows, and only a sequence can show it.
 */
export const FoldsBrokenByEachLoudKind: Story = {
  args: { rows: [QUIET, MUTATION, QUIET, FAILED_CALL, QUIET, COMMAND, QUIET] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Four folds, never merged across the three loud rows between them.
    await expect(canvas.getAllByText('Read 2 · Searched 1')).toHaveLength(4)
    await expect(canvas.getByText('Edit')).toBeInTheDocument()
    await expect(canvas.getByText('Failed')).toBeInTheDocument()
    await expect(canvas.getByText('Run')).toBeInTheDocument()
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
