import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { expect, userEvent, within } from 'storybook/test'

import { AppNavigationRail } from './app-navigation-rail'

const meta = {
  title: 'App/Navigation/Navigation Rail',
  component: AppNavigationRail,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/projects/storybook-project/sessions']}>
        <div className="h-dvh">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof AppNavigationRail>

export default meta
type Story = StoryObj<typeof AppNavigationRail>

export const Navigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sessions = canvas.getByRole('button', { name: 'Sessions' })

    await expect(sessions.querySelector('[data-icon="messages-square"]')).not.toBeNull()

    await userEvent.click(canvas.getByRole('button', { name: 'Tickets' }))
    await expect(canvas.getByRole('button', { name: 'Tickets' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Atlas' }))
    await expect(canvas.getByRole('button', { name: 'Atlas' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Sessions' }))
    await expect(canvas.getByRole('button', { name: 'Sessions' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  },
}
