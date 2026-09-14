import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ClaudePermissionPrompt } from './ClaudePermissionPrompt'

const meta = {
  title: 'Sessions/Permission Prompt',
  component: ClaudePermissionPrompt,
  args: {
    permission: {
      id: 'permission-one',
      sessionId: 'session-one',
      description: 'Bash {"command":"bun test"}',
    },
    onDecide: fn(async () => true),
  },
} satisfies Meta<typeof ClaudePermissionPrompt>

export default meta
type Story = StoryObj<typeof meta>

export const Pending: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Allow this?' })).toBeInTheDocument()
    await expect(canvas.getByText(/bun test/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Allow' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Deny' })).toBeEnabled()
  },
}

export const Deciding: Story = {
  args: { onDecide: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Allow' }))
    await expect(canvas.getByRole('button', { name: 'Allow' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Deny' })).toBeDisabled()
  },
}

export const Refused: Story = {
  args: { onDecide: fn(async () => false) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Deny' }))
    await expect(canvas.getByRole('button', { name: 'Allow' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Deny' })).toBeEnabled()
  },
}
