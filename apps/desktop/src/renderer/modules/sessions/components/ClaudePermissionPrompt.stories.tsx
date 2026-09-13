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
      toolName: 'Bash',
      input: { command: 'bun test' },
    },
    onDecide: fn(async () => true),
  },
} satisfies Meta<typeof ClaudePermissionPrompt>

export default meta
type Story = StoryObj<typeof meta>

export const Pending: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Allow' }))
    await expect(args.onDecide).toHaveBeenCalledWith('allow')
  },
}
