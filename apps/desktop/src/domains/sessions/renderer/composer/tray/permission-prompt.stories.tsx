import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import type { Permission } from '@/domains/sessions/api/permissions'
import { PermissionPrompt } from '@/platform/renderer/components/permission/permission-prompt'
import '../editor/composer-content.css'
import { AttachmentTray } from './attachment-tray'

const permission: Permission = {
  id: 'permission-one',
  sessionId: 'session-one',
  description: 'Bash {"command":"bun test"}',
}

const meta = {
  title: 'Features/Sessions/Composer/Permission Prompt',
  component: PermissionPrompt,
  args: { harness: 'claude', permission, onDecide: fn(async () => true) },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-(--size-session-column) pt-6">
        <AttachmentTray>
          <Story />
        </AttachmentTray>
        <div className="relative z-10 h-14 rounded-xl border bg-card" />
      </div>
    ),
  ],
} satisfies Meta<typeof PermissionPrompt>

export default meta
type Story = StoryObj<typeof meta>

export const Pending: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Permission needed' })).toBeInTheDocument()
    await expect(canvas.getByText(/bun test/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Allow' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Deny' })).toBeEnabled()
  },
}

export const AcpChoices: Story = {
  args: { harness: 'claude-acp', permission: { ...permission, decisions: ['allow', 'deny'] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'More ways to allow' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Allow' }))
    await expect(args.onDecide).toHaveBeenCalledWith('allow')
  },
}

export const DenyOnly: Story = {
  args: { harness: 'claude-acp', permission: { ...permission, decisions: ['deny'] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Allow' })).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'More ways to allow' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Deny' }))
    await expect(args.onDecide).toHaveBeenCalledWith('deny')
  },
}

// Claude's gate remembers similar calls; the same answer reads as a Session-wide allow for Codex.
export const AllowSimilar: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More ways to allow' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Allow similar' }))
    await expect(args.onDecide).toHaveBeenCalledWith('allowForSession')
  },
}

export const AllowAll: Story = {
  args: { harness: 'codex' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'More ways to allow' }))
    await expect(await screen.findByRole('menuitem', { name: 'Allow all' })).toBeInTheDocument()
    await expect(screen.queryByRole('menuitem', { name: 'Allow similar' })).toBeNull()
    await userEvent.keyboard('{Escape}')
  },
}

// Answered, it collapses out of the tray the way a queued turn leaves, then unmounts.
export const LeavesTheTray: Story = {
  render: (args) => {
    const [pending, setPending] = useState<Permission | null>(permission)
    return (
      <PermissionPrompt
        {...args}
        permission={pending}
        onDecide={async () => {
          setPending(null)
          return true
        }}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Allow' }))
    await expect(canvas.getByRole('heading', { name: 'Permission needed' })).toBeInTheDocument()
    await waitFor(() => expect(canvas.queryByText(/bun test/)).toBeNull())
    await expect(canvas.queryByRole('heading', { name: 'Permission needed' })).toBeNull()
  },
}

export const Deciding: Story = {
  args: { onDecide: fn(() => new Promise<boolean>(() => {})) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Allow' }))
    await expect(canvas.getByRole('button', { name: 'Allow' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Deny' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'More ways to allow' })).toBeDisabled()
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

export const SplitActionKeyboard: Story = {
  args: { onDecide: fn(async () => false) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'More ways to allow' })
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Deny' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: 'Allow' })).toHaveFocus()
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(await screen.findByRole('menuitem', { name: 'Allow similar' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(args.onDecide).not.toHaveBeenCalled()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'Allow similar' })).toHaveFocus(),
    )
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(args.onDecide).toHaveBeenCalledWith('allowForSession'))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => {
      expect(trigger).toBeEnabled()
      expect(trigger).toHaveFocus()
    })
  },
}
