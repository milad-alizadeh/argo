import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import type { ConnectionSummary } from '@/domains/tickets/contract/contract'
import { ConnectionStatusMark } from './connection-status-mark'

const meta: Meta<typeof ConnectionStatusMark> = {
  title: 'Tickets/Connection Status Mark',
  component: ConnectionStatusMark,
  args: { children: 'GitHub · octocat' },
}

export default meta
type Story = StoryObj<typeof ConnectionStatusMark>

// One entry per ConnectionSummary['state'], so a new state added there fails this story until covered here.
const STATE_TEXT: Record<ConnectionSummary['state'], string> = {
  ready: 'Connected',
  'account-expired': 'Sign-in expired',
  'account-revoked': 'Access revoked',
  'account-unreadable': 'Sign-in unreadable',
  'account-missing': 'Disconnected',
}

export const States: Story = {
  render: () => (
    <>
      {(Object.keys(STATE_TEXT) as ConnectionSummary['state'][]).map((state) => (
        <p
          key={state}
          className="flex w-(--size-cockpit-sidebar-default) items-center gap-(--spacing-shell-item) type-meta text-muted-foreground"
        >
          <ConnectionStatusMark state={state}>GitHub · octocat</ConnectionStatusMark>
        </p>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const lines = within(canvasElement).getAllByRole('paragraph')

    for (const [index, text] of Object.values(STATE_TEXT).entries()) {
      const line = lines[index]
      if (!line) throw new Error(`Expected a rendered line for state ${index}`)
      await expect(within(line).getByText(text)).toHaveClass('sr-only')
      // The state follows the label, so a button built on it is named "GitHub · octocat Connected".
      await expect(line).toHaveTextContent(`GitHub · octocat${text}`)
    }
  },
}
