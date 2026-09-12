import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { CockpitNavigationRail } from './CockpitNavigationRail'
import { CockpitShell } from './CockpitShell'

const meta: Meta<typeof CockpitShell> = {
  title: 'Cockpit/Shell',
  component: CockpitShell,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof CockpitShell>

const args = {
  rail: <CockpitNavigationRail />,
  sidebar: <aside aria-label="Cockpit sidebar" />,
  children: <main aria-label="Cockpit content" />,
}

export const SidebarControls: Story = { args }

export const ShellInteractions: Story = {
  args,
  tags: ['!dev', '!autodocs'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sidebar = canvas.getByLabelText('Cockpit sidebar')
    const sidebarResizeHandle = canvas.getByRole('separator')
    const initialSidebarWidth = sidebar.getBoundingClientRect().width

    const resizeHandleRectangle = sidebarResizeHandle.getBoundingClientRect()
    await userEvent.pointer([
      {
        target: sidebarResizeHandle,
        keys: '[MouseLeft>]',
        coords: { x: resizeHandleRectangle.x, y: resizeHandleRectangle.y + resizeHandleRectangle.height / 2 },
      },
      { coords: { x: resizeHandleRectangle.x + 64, y: resizeHandleRectangle.y + resizeHandleRectangle.height / 2 } },
      { keys: '[/MouseLeft]' },
    ])
    await expect(sidebar.getBoundingClientRect().width).toBeGreaterThan(initialSidebarWidth)

    const snappedHandleRectangle = sidebarResizeHandle.getBoundingClientRect()
    await userEvent.pointer([
      {
        target: sidebarResizeHandle,
        keys: '[MouseLeft>]',
        coords: { x: snappedHandleRectangle.x, y: snappedHandleRectangle.y + snappedHandleRectangle.height / 2 },
      },
      { coords: { x: snappedHandleRectangle.x - 640, y: snappedHandleRectangle.y + snappedHandleRectangle.height / 2 } },
      { keys: '[/MouseLeft]' },
    ])
    await expect(sidebar.getBoundingClientRect().width).toBe(0)
    await expect(canvas.getByLabelText('Main navigation')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Open Sessions sidebar' }))
    await expect(sidebar.getBoundingClientRect().width).toBe(initialSidebarWidth)

    await userEvent.click(canvas.getByRole('button', { name: 'Tickets' }))
    await expect(canvas.getByRole('button', { name: 'Tickets' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(canvas.getByRole('button', { name: 'Atlas' }))
    await expect(canvas.getByRole('button', { name: 'Atlas' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(canvas.getByRole('button', { name: 'Files' }))
    await expect(canvas.getByRole('button', { name: 'Atlas' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(canvas.getByRole('button', { name: 'Sessions' }))
    await expect(canvas.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-current', 'page')
  },
}
