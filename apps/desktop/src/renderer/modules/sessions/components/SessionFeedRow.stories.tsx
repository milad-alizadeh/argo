import type { Meta, StoryObj } from '@storybook/react'
import { SessionFeedRow } from './SessionFeedRow'
import { feedRowsStory } from './stories.fixtures'

const meta: Meta<typeof SessionFeedRow> = {
  title: 'Sessions/SessionFeedRow',
  component: SessionFeedRow,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionFeedRow>

const [promptRow, thoughtRow, replyRow, sourceRow, interruptedRow, compactedRow, unreadableRow] =
  feedRowsStory

// One story per shape. No story states a height: a row is given one only by the pass that
// measured it, and a story that wrote one by hand would draw a box no measurement produced.
// What the reader typed: the one row drawn in a bubble, kept as typed and never read as Markdown.
export const Prompt: Story = { args: { row: promptRow } }
// A Thought: shadcn's Marker on one line, the word and as much of the text as fits.
export const Thought: Story = { args: { row: thoughtRow } }
// What Claude wrote, drawn as Markdown with no speaker label.
export const Reply: Story = { args: { row: replyRow } }
// The honest source fallback: the block's own type, and its own JSON under it, unsummarised.
export const Source: Story = { args: { row: sourceRow } }
// A Turn the person stopped: a Marker note in line with the rows around it.
export const Interrupted: Story = { args: { row: interruptedRow } }
// A Compaction: the Marker's labelled separator between the history before and after it.
export const Compacted: Story = { args: { row: compactedRow } }
// A transcript line Argo could not read, drawn rather than dropped, at the stated arithmetic
// height of ADR-0033 rule 1.
export const Unreadable: Story = { args: { row: unreadableRow } }
