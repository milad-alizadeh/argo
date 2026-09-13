import type { Meta, StoryObj } from '@storybook/react'
import { expect, waitFor, within } from 'storybook/test'

import { App } from './App'

const meta: Meta<typeof App> = {
  title: 'Cockpit/Application',
  component: App,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof App>

function pressDestinationShortcut(canvasElement: HTMLElement, key: string) {
  const view = canvasElement.ownerDocument.defaultView
  if (!view) return
  view.dispatchEvent(new view.KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key }))
}

export const KeyboardRoutes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Sessions' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    pressDestinationShortcut(canvasElement, '2')
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Tickets' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    )
    pressDestinationShortcut(canvasElement, '3')
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Atlas' })).toHaveAttribute('aria-current', 'page'),
    )
    pressDestinationShortcut(canvasElement, '1')
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Sessions' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    )
  },
}
