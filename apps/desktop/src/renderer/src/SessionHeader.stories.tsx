import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SessionHeader } from './SessionHeader'
import type { WorkspaceModel } from './sessionScreenModel'

const WORKSPACE: WorkspaceModel = {
  branch: 'feat/auth-rotation',
  tree: 'worktree',
  directory: '/argo/.worktrees/auth-rotation',
  dirty: 3,
  ahead: 2,
  behind: 0,
  sharedCount: 1,
}

const meta = {
  title: 'SessionScreen/SessionHeader',
  component: SessionHeader,
  args: {
    project: 'argo',
    title: 'Refactor auth module',
    workspace: WORKSPACE,
    variant: 'split',
    onToggleDelivery: fn(),
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SessionHeader>

export default meta
type Story = StoryObj<typeof meta>

/** A full header: the leading close "✕", breadcrumb, workspace chip, and the Delivery toggle
 * pressed (region showing). Clicking "✕" reports the close so the spine can drop to roster-only. */
export const WorkspacePresent: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Refactor auth module')).toBeInTheDocument()
    await expect(canvas.getByText('feat/auth-rotation')).toBeInTheDocument()
    const toggle = canvas.getByRole('button', { name: 'Delivery' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('button', { name: 'Close session' }))
    await expect(args.onClose).toHaveBeenCalledOnce()
  },
}

/** Honest-empty: the projection carries no branch yet, so the workspace chip is simply absent. */
export const HonestEmpty: Story = {
  args: { workspace: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Refactor auth module')).toBeInTheDocument()
    await expect(canvas.queryByText('feat/auth-rotation')).not.toBeInTheDocument()
  },
}

/** Solo — the Delivery region is out of the work row, so the toggle reads unpressed. */
export const ToggleSolo: Story = {
  args: { variant: 'solo' },
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole('button', { name: 'Delivery' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  },
}
