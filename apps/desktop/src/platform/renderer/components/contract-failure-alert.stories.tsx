import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { accountError } from '@/domains/accounts/contract/contract'
import { ticketError } from '@/domains/tickets/api/errors'
import { i18n } from '../i18n/i18n'
import { ContractFailureAlert } from './contract-failure-alert'

const meta = {
  title: 'Design System/Patterns/Contract Failure Alert',
  component: ContractFailureAlert,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: { error: accountError('sign-in-expired', 'notice-story') },
} satisfies Meta<typeof ContractFailureAlert>
export default meta
type Story = StoryObj<typeof meta>

export const AccountFailure: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'The sign-in expired before it was finished. Start again.',
    )
  },
}

export const TicketFailure: Story = {
  args: { error: ticketError('not-connected', 'notice-story') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'This Project has no connected Ticket source.',
    )
  },
}

const longError =
  'The sign-in expired before the Account connected. Start the sign-in again and enter the new device code on the provider page. Keep this window open until the provider confirms access. The provider can reject the sign-in when the code expires, the Account changes, or the repository owner removes access. Argo will keep the Project available while you reconnect the Account.'
export const LongError: Story = {
  beforeEach: async () => {
    const previousLanguage = i18n.language
    i18n.addResourceBundle('zz-notice', 'accounts', { error: { 'sign-in-expired': longError } })
    await i18n.changeLanguage('zz-notice')
    return async () => {
      i18n.removeResourceBundle('zz-notice', 'accounts')
      await i18n.changeLanguage(previousLanguage)
    }
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(longError)
  },
}
