import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DevelopmentIdentityBar } from '@/domains/sessions/renderer/composer/development-identity-bar'
import { WINDOW_MINIMUM_WIDTH } from '@/platform/contract/minimum-width'

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
    // The bar sits in the Session column when a Ticket is linked, and spans the shell footer when
    // none is. `fullWidth` picks which of the two a story renders in.
    (Story, context) => (
      <div
        className={
          context.parameters.fullWidth ? 'w-full' : 'mx-auto max-w-(--size-session-column)'
        }
      >
        <Story />
      </div>
    ),
  ],
  title: 'Sessions/Composer/Development Identity Bar',
} satisfies Meta<typeof DevelopmentIdentityBar>

export default meta
type Story = StoryObj<typeof meta>

export const LinkedTicket: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bar = canvas.getByLabelText('Development build')

    await expect(canvas.getByText('Isolate desktop development launches')).toBeVisible()
    await expect(canvas.getByText(identity.worktree)).toBeVisible()
    // Two development apps are told apart by the instance, not by the branch they share.
    await expect(canvas.getByText('-a1b2c3d4')).toBeVisible()
    await expect(canvas.getByTitle(identity.id)).toBeVisible()
    await expect(bar).toHaveAttribute('data-development-instance', identity.id)
    await expect(bar).toHaveAttribute('data-ticket-key', '#2173')
  },
}

// The shipped shell footer: no Ticket, the whole window wide, and an instance of the length the
// launcher really produces (worktree folder plus eight hash characters).
const LONG_INSTANCE = {
  id: 'ticket-2304-shared-account-store-3a340324',
  label: '#2304',
  title: 'Argo dev · #2304 · :45304',
  worktree: '/Users/developer/argo/.claude/worktrees/ticket-2304-shared-account-store',
}

export const UnlinkedAtWindowMinimum: Story = {
  args: { identity: LONG_INSTANCE, ticket: null },
  decorators: [
    (Story) => (
      <div style={{ width: WINDOW_MINIMUM_WIDTH }}>
        <Story />
      </div>
    ),
  ],
  parameters: { fullWidth: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('-3a340324')).toBeVisible()
    const worktree = canvas.getByText(LONG_INSTANCE.worktree)
    await expect(worktree.clientWidth).toBeGreaterThan(150)
    await expect(canvas.getByTitle(LONG_INSTANCE.id)).toBeInTheDocument()
  },
}
