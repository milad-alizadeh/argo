import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'

import { App } from '@/platform/renderer/app'

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

// The window key handler is registered in an effect, so a single press sent the moment the story
// mounts can land before there is anything listening and is then lost for good. Pressing inside
// the wait sends it again until the destination changes, which is what a person does anyway.
async function routeByShortcut(canvasElement: HTMLElement, key: string, destination: string) {
  const canvas = within(canvasElement)
  const view = canvasElement.ownerDocument.defaultView
  if (!view) throw new Error('the story is not in a window')
  await waitFor(() => {
    view.dispatchEvent(new view.KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key }))
    expect(canvas.getByRole('button', { name: destination })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
}

export const KeyboardRoutes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Sessions' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await routeByShortcut(canvasElement, '2', 'Tickets')
    await routeByShortcut(canvasElement, '3', 'Atlas')
    await routeByShortcut(canvasElement, '1', 'Sessions')
  },
}
