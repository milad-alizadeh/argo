import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { WorkspaceIdentity } from './WorkspaceIdentity'

const meta = {
  title: 'Shared/WorkspaceIdentity',
  component: WorkspaceIdentity,
  argTypes: {
    branch: { control: 'text' },
    tree: { control: 'select', options: ['main', 'worktree'] },
    directory: { control: 'text' },
    dirty: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    ahead: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    behind: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    sharedCount: { control: { type: 'range', min: 1, max: 6, step: 1 } },
  },
} satisfies Meta<typeof WorkspaceIdentity>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The everyday shape: a branch-named worktree with work in flight. Every other tag and flag
 * is a control or a row of `AllVariants` — the tag is a `select`, the counts are ranges.
 */
export const Default: Story = {
  args: {
    branch: 'feat/auth-rotation',
    tree: 'worktree',
    directory: '/worktrees/auth-rotation',
    dirty: 3,
    ahead: 2,
    behind: 1,
    sharedCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('feat/auth-rotation')).toBeInTheDocument()
    await expect(canvas.getByText('worktree')).toBeInTheDocument()
    await expect(canvas.getByText(/3 dirty/)).toBeInTheDocument()
    await expect(canvas.getByText('↑2 ↓1 vs main')).toBeInTheDocument()
    // No shared-tree warning while this session owns the tree.
    await expect(canvas.queryByText(/shared tree/)).not.toBeInTheDocument()
  },
}

/**
 * Nothing outstanding: the dirty chip is gone and the sync line reads level — the designed
 * zero state, not a smaller number.
 */
export const Clean: Story = {
  args: {
    ...Default.args,
    dirty: 0,
    ahead: 0,
    behind: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('= vs main')).toBeInTheDocument()
    await expect(canvas.queryByText(/dirty/)).not.toBeInTheDocument()
  },
}

/** Every tag and flag in one frame — the visual-diff surface for the whole chip. */
export const AllVariants: Story = {
  args: Default.args,
  render: () => (
    <div className="flex flex-col items-start gap-gap">
      <WorkspaceIdentity
        branch="main"
        tree="main"
        directory="/repository"
        dirty={0}
        ahead={0}
        behind={0}
        sharedCount={1}
      />
      <WorkspaceIdentity
        branch="feat/auth-rotation"
        tree="worktree"
        directory="/worktrees/auth-rotation"
        dirty={0}
        ahead={0}
        behind={0}
        sharedCount={1}
      />
      <WorkspaceIdentity
        branch="feat/auth-rotation"
        tree="worktree"
        directory="/worktrees/hotfix"
        dirty={3}
        ahead={2}
        behind={1}
        sharedCount={1}
      />
      <WorkspaceIdentity
        branch="feat/auth-rotation"
        tree="worktree"
        directory="/worktrees/auth-rotation"
        dirty={1}
        ahead={0}
        behind={2}
        sharedCount={3}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('main tree')).toBeInTheDocument()
    await expect(canvas.getByText('/worktrees/hotfix')).toBeInTheDocument()
    await expect(canvas.getByText(/shared tree · 3 sessions/)).toBeInTheDocument()
  },
}
