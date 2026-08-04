import type { FeedRow } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { aDiff, DELETED_HUNKS, ROTATION_HUNKS } from '../__fixtures__/diff'
import { MutationRow } from './MutationRow'

const row = (over: Partial<Extract<FeedRow, { kind: 'mutation' }>> = {}) => ({
  kind: 'mutation' as const,
  key: 'mutation:c2',
  path: 'src/auth/rotation.ts',
  status: 'completed' as const,
  diff: aDiff(),
  ...over,
})

const meta = {
  title: 'Sessions/Activity/MutationRow',
  component: MutationRow,
  args: { row: row() },
  argTypes: { row: { control: false, table: { type: { summary: 'FeedRow' } } } },
  decorators: [
    (Story) => (
      <div className="w-lg bg-panel p-region">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MutationRow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A file the agent edited, with its diff already on screen. Nothing was clicked to get here: the
 * one thing a returning reader must not be able to scroll past is a change to their code.
 *
 * The caption under the patch is load-bearing. This renderer is shared with Delivery's Files view,
 * whose diff IS the current state of a branch, and this one is not — it is what that edit changed
 * at the moment it was made.
 */
export const Modified: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('edited')).toBeInTheDocument()
    await expect(canvas.getByText('+6')).toBeInTheDocument()
    await expect(canvas.getByText('-1')).toBeInTheDocument()
    await expect(canvas.getByText(/not the file as it is now/)).toBeInTheDocument()
  },
}

/** A new file. Its own word, icon and rail — never flattened into "edited", because a file that did
 * not exist before is a different fact about the change than a line moved inside one. */
export const Created: Story = {
  args: {
    row: row({
      path: 'src/auth/rotation.ts',
      diff: aDiff({ change: 'create', added: 6, removed: 0, hunks: ROTATION_HUNKS.slice(0, 1) }),
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('created')).toBeInTheDocument()
  },
}

/** A file that is gone. The loudest row this feed draws — three channels say so at once, because a
 * deletion scrolled past unnoticed is the most expensive thing this surface can do. */
export const Deleted: Story = {
  args: {
    row: row({
      path: 'src/auth/legacy.ts',
      diff: aDiff({ change: 'delete', added: 0, removed: 4, hunks: DELETED_HUNKS }),
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('deleted')).toBeInTheDocument()
    await expect(canvas.getByText('-4')).toBeInTheDocument()
  },
}

/** Over the bound: the first hunk, and how many are left. One 400-line edit rendered whole would
 * bury the paragraph that explains it, which is the failure this whole surface corrects. */
export const OverTheBound: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /show 1 more hunk$/ })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByText(/this\.#keys\.unshift/)).toBeInTheDocument()
  },
}

/** A patch that fits inside the bound shows no expander — there is nothing behind it to open. */
export const AtTheBound: Story = {
  args: {
    row: row({
      diff: aDiff({ hunks: ROTATION_HUNKS.slice(0, 1), added: 6, removed: 0 }),
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument()
  },
}

/** The call was made and nothing has come back. Pending, never dressed as finished — the result may
 * still be coming, and a turn that was interrupted means it never will. */
export const Pending: Story = {
  args: { row: row({ status: 'pending', diff: null }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('editing')).toBeInTheDocument()
    await expect(canvas.getByText(/no result yet/)).toBeInTheDocument()
  },
}

/** A binary file, or a patch the record did not carry. The change is still reported; only the diff
 * is missing, and the row says which. */
export const NoDiffAvailable: Story = {
  args: {
    row: row({ path: 'resources/icon.png', diff: aDiff({ hunks: [], added: 0, removed: 0 }) }),
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('no diff available')).toBeInTheDocument()
  },
}

/** The edit failed. Its own word and tone, and no diff to show — a failure that rendered as a quiet
 * completed row would be the worst kind of wrong. */
export const Failed: Story = {
  args: { row: row({ path: 'src/auth/x.ts', status: 'failed', diff: null }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('failed')).toBeInTheDocument()
  },
}
