import type { Meta, StoryObj } from '@storybook/react'
import { expect, within } from 'storybook/test'

import { ConnectionStatusMark } from './ConnectionStatusMark'

const meta: Meta<typeof ConnectionStatusMark> = {
  title: 'Tickets/Connection Status Mark',
  component: ConnectionStatusMark,
  args: { children: 'GitHub · octocat' },
  decorators: [
    (Story) => (
      <p className="flex w-(--size-cockpit-sidebar-default) items-center gap-(--spacing-shell-item) type-meta text-muted-foreground">
        <Story />
      </p>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ConnectionStatusMark>

const says =
  (text: string): Story['play'] =>
  async ({ canvasElement }) => {
    const line = within(canvasElement).getByRole('paragraph')
    await expect(within(line).getByText(text)).toHaveClass('sr-only')
    // The state follows the label, so a button built on it is named "GitHub · octocat Connected".
    await expect(line).toHaveTextContent(`GitHub · octocat${text}`)
  }

export const Connected: Story = { args: { state: 'ready' }, play: says('Connected') }

// An unreadable sign-in draws this same dot; only its hidden words differ.
export const AccessRevoked: Story = {
  args: { state: 'account-revoked' },
  play: says('Access revoked'),
}

export const Disconnected: Story = {
  args: { state: 'account-missing' },
  play: says('Disconnected'),
}
