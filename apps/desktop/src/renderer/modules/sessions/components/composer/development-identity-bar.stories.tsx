import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { DevelopmentIdentityBar } from './development-identity-bar'

const identity = {
  id: 'ticket-2173-a1b2c3d4',
  label: '#2173',
  title: 'Argo dev · #2173 · :45173',
  worktree: '/Users/developer/argo/.claude/worktrees/ticket-2173-isolate-launches',
}

const meta = {
  args: {
    identity,
    ticket: {
      key: '#2173',
      title: 'Isolate desktop development launches',
    },
  },
  component: DevelopmentIdentityBar,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-(--size-session-column)">
        <Story />
      </div>
    ),
  ],
  title: 'Sessions/DevelopmentIdentityBar',
} satisfies Meta<typeof DevelopmentIdentityBar>

export default meta
type Story = StoryObj<typeof meta>

export const LinkedTicket: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = canvas.getByLabelText('Development build')

    await expect(canvas.getByText('Isolate desktop development launches')).toBeVisible()
    await expect(canvas.getByText(identity.worktree)).toBeVisible()
    await expect(bar).toHaveAttribute('data-development-instance', identity.id)
    await expect(bar).toHaveAttribute('data-ticket-key', '#2173')
  },
}
