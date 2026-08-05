import type { CallRowModel } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { CallRow } from './CallRow'

const ROOT = '/Users/me/argo/.claude/worktrees/ticket-318'

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
  // The session's own working directory. Every path on the feed is shown relative to it, so a story
  // without one would render the absolute paths the surface exists to stop repeating.
  args: { row: row(), root: ROOT },
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
    // NAME first, directory after it — the two are separate cells, so the filename sits at a fixed
    // x down the column and never truncates. Both are present; neither is the whole path, which is
    // the point, and the whole path is on the row's `title` and inside the box it opens.
    await expect(canvas.getByText('Read')).toBeInTheDocument()
    await expect(canvas.getByText('gone.ts')).toBeInTheDocument()
    await expect(canvasElement.textContent).toContain('src/auth')
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
