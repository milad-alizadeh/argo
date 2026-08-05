import type { CallRowModel } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { CallRow } from './CallRow'

const TYPECHECK_ERROR = `src/renderer/src/rooms/sessions/interiorActivity.ts(198,44): error TS2554
  Expected 1 arguments, but got 2.`

const row = (over: Partial<CallRowModel> = {}): CallRowModel => ({
  kind: 'call',
  key: 'call:c3',
  callKind: 'execute',
  name: 'Bash',
  target: 'bun run typecheck',
  status: 'completed',
  output: { kind: 'output', tier: 'direct', text: '$ tsc --noEmit -p tsconfig.web.json' },
  ...over,
})

const meta = {
  title: 'Sessions/Activity/CallRow',
  component: CallRow,
  args: { row: row() },
  argTypes: { row: { control: false, table: { type: { summary: 'CallRowModel' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CallRow>

export default meta
type Story = StoryObj<typeof meta>

/** A command that passed. Its command line is on screen without asking and its output is one click
 * away, so a run of commands can be scanned without wading through build logs. */
export const Ran: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('bun run typecheck')).toBeInTheDocument()
    await expect(canvas.queryByText(/tsc --noEmit/)).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByText(/tsc --noEmit/)).toBeInTheDocument()
  },
}

/** The command failed. The ring and the mark say so on the closed line — which is what stops it
 * being scrolled past as one more piece of chatter — and the reason is behind the same caret every
 * other row uses, because a column where failures are tall and successes are short cannot be
 * skimmed at all. */
export const Failed: Story = {
  args: {
    row: row({
      status: 'failed',
      output: { kind: 'output', tier: 'direct', text: TYPECHECK_ERROR },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Failed')).toBeInTheDocument()
    await expect(canvas.queryByText(/Expected 1 arguments/)).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByText(/Expected 1 arguments/)).toBeInTheDocument()
  },
}

/** A failure of a kind that is otherwise QUIET. It breaks out of the fold and states what it was —
 * the host's own tool name beside its target, since `Read` is what says what the path was for. */
export const FailedRead: Story = {
  args: {
    row: row({
      callKind: 'read',
      name: 'Read',
      target: 'src/auth/gone.ts',
      status: 'failed',
      output: { kind: 'output', tier: 'direct', text: 'File does not exist.' },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The path is ONE run, cut from the START — so a row narrower than the path keeps its TAIL, and
    // a column of reads under one worktree no longer renders as the same shared prefix on every
    // line. The whole string is in the DOM; the ellipsis is the browser's, not ours.
    await expect(canvas.getByText('Read')).toBeInTheDocument()
    await expect(canvasElement.textContent).toContain('src/auth/gone.ts')
  },
}

/** Still running: nothing has been printed yet, and what the row opens onto says exactly that
 * rather than being an expander onto an empty box. */
export const Running: Story = {
  args: { row: row({ status: 'in_progress', output: null }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Run')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByText(/has not come back/)).toBeInTheDocument()
  },
}

/** A command that printed nothing at all — `mkdir`, a formatter with no changes. Honest about it
 * rather than rendering an empty expandable that lied about having something behind it. */
export const NoOutput: Story = {
  args: { row: row({ target: 'mkdir -p out', output: null }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByText(/printed nothing/)).toBeInTheDocument()
  },
}
