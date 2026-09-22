import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'
import type { Permission } from '@/domains/sessions/contract/ipc/contract'
import { PendingTurns } from '@/domains/sessions/renderer/composer/tray/pending-turns'
import { PermissionPrompt } from '@/platform/renderer/components/permission-prompt'
import '../composer-content.css'
import { AttachmentTray } from '@/domains/sessions/renderer/composer/tray/attachment-tray'

const permission: Permission = {
  id: 'permission-one',
  sessionId: 'session-one',
  description: 'Bash {"command":"bun test"}',
}

const meta = {
  title: 'Sessions/Composer/Permission Prompt',
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

// Claude's gate remembers similar calls; the same answer reads as a Session-wide allow for Codex.
export const AllowSimilar: Story = {
  render: (args) => {
    const [answer, setAnswer] = useState<string | null>(null)
    return (
      <>
        <PermissionPrompt
          {...args}
          onDecide={async (decision) => {
            setAnswer(decision)
            return true
          }}
        />
        <output aria-label="Answer">{answer}</output>
      </>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'More ways to allow' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Allow similar' }))
    await expect(canvas.getByRole('status', { name: 'Answer' })).toHaveTextContent(
      'allowForSession',
    )
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

// One tray holds both: the Permission on top, the queue under it, at one width.
export const AboveTheQueue: Story = {
  render: (args) => (
    <>
      <PermissionPrompt {...args} />
      <PendingTurns
        turns={[{ id: 'queued', text: 'Then run the linter', attachments: [] }]}
        onEdit={() => {}}
        onRemove={() => {}}
        onReorder={() => {}}
        onSteer={async () => false}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const prompt = canvas.getByRole('region', { name: 'Permission needed' }).getBoundingClientRect()
    const queue = canvas.getByRole('region', { name: 'Pending Turns' }).getBoundingClientRect()
    await expect(prompt.bottom).toBeLessThanOrEqual(queue.top)
    await expect(prompt.width).toBe(queue.width)
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

// Answered from the keyboard, the leaving card hands focus to the queue under it.
export const HandsFocusOn: Story = {
  render: (args) => {
    const [pending, setPending] = useState<Permission | null>(permission)
    return (
      <>
        <PermissionPrompt
          {...args}
          permission={pending}
          onDecide={async () => {
            setPending(null)
            return true
          }}
        />
        <PendingTurns
          turns={[{ id: 'queued', text: 'Then run the linter', attachments: [] }]}
          onEdit={() => {}}
          onRemove={() => {}}
          onReorder={() => {}}
          onSteer={async () => false}
        />
      </>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    canvas.getByRole('button', { name: 'Allow' }).focus()
    await userEvent.keyboard('{Enter}')
    const queue = canvas.getByRole('region', { name: 'Pending Turns' })
    await waitFor(() => expect(queue).toContainElement(document.activeElement as HTMLElement))
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
