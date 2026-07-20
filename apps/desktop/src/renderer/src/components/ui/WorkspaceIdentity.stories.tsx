import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { WorkspaceIdentity } from './WorkspaceIdentity'

const meta = {
  title: 'Cockpit/WorkspaceIdentity',
  component: WorkspaceIdentity,
  argTypes: {
    branch: { control: 'text' },
    tree: { control: 'select', options: ['main', 'worktree'] },
    dir: { control: 'text' },
    dirty: { control: { type: 'range', min: 0, max: 12, step: 1 } },
    ahead: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    behind: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    sharedCount: { control: { type: 'range', min: 1, max: 6, step: 1 } },
  },
} satisfies Meta<typeof WorkspaceIdentity>

export default meta
type Story = StoryObj<typeof meta>

// A branch-named worktree with work in flight: the branch, the `wt` tag, the amber dirty
// count, and the ahead/behind line — the everyday shape.
export const Default: Story = {
  args: {
    branch: 'feat/auth-rotation',
    tree: 'worktree',
    dir: '/wt/auth-rotation',
    dirty: 3,
    ahead: 2,
    behind: 1,
    sharedCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('feat/auth-rotation')).toBeInTheDocument()
    await expect(canvas.getByText('wt')).toBeInTheDocument()
    await expect(canvas.getByText(/3 dirty/)).toBeInTheDocument()
    await expect(canvas.getByText('↑2 ↓1 vs main')).toBeInTheDocument()
    // No shared-tree warning while this session owns the tree.
    await expect(canvas.queryByText(/shared tree/)).not.toBeInTheDocument()
  },
}

// The base tree wears `main tree` instead of a worktree tag; the dir never surfaces.
export const MainTree: Story = {
  args: {
    branch: 'main',
    tree: 'main',
    dir: '/repo',
    dirty: 0,
    ahead: 0,
    behind: 0,
    sharedCount: 1,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('main tree')).toBeInTheDocument()
  },
}

// An adopted worktree — its dir leaf diverges from the branch, so the tag spells the dir.
export const AdoptedWorktree: Story = {
  args: {
    branch: 'feat/auth-rotation',
    tree: 'worktree',
    dir: '/wt/hotfix',
    dirty: 0,
    ahead: 4,
    behind: 0,
    sharedCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('/wt/hotfix')).toBeInTheDocument()
    await expect(canvas.getByText('↑4 vs main')).toBeInTheDocument()
  },
}

// Nothing outstanding: no dirty chip, level with main — the calm end of the range.
export const Clean: Story = {
  args: {
    branch: 'feat/auth-rotation',
    tree: 'worktree',
    dir: '/wt/auth-rotation',
    dirty: 0,
    ahead: 0,
    behind: 0,
    sharedCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('= vs main')).toBeInTheDocument()
    await expect(canvas.queryByText(/dirty/)).not.toBeInTheDocument()
  },
}

// Two sessions resolve to one tree — the amber warning names how many.
export const SharedTree: Story = {
  args: {
    branch: 'feat/auth-rotation',
    tree: 'worktree',
    dir: '/wt/auth-rotation',
    dirty: 1,
    ahead: 0,
    behind: 2,
    sharedCount: 2,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/shared tree · 2 sessions/)).toBeInTheDocument()
  },
}

// Every tag and flag in one frame — the visual-diff surface for the whole chip.
export const AllVariants: Story = {
  args: Default.args,
  render: () => (
    <div className="flex flex-col items-start gap-gap">
      <WorkspaceIdentity
        branch="main"
        tree="main"
        dir="/repo"
        dirty={0}
        ahead={0}
        behind={0}
        sharedCount={1}
      />
      <WorkspaceIdentity
        branch="feat/auth-rotation"
        tree="worktree"
        dir="/wt/auth-rotation"
        dirty={0}
        ahead={0}
        behind={0}
        sharedCount={1}
      />
      <WorkspaceIdentity
        branch="feat/auth-rotation"
        tree="worktree"
        dir="/wt/hotfix"
        dirty={3}
        ahead={2}
        behind={1}
        sharedCount={1}
      />
      <WorkspaceIdentity
        branch="feat/auth-rotation"
        tree="worktree"
        dir="/wt/auth-rotation"
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
    await expect(canvas.getByText('/wt/hotfix')).toBeInTheDocument()
    await expect(canvas.getByText(/shared tree · 3 sessions/)).toBeInTheDocument()
  },
}
