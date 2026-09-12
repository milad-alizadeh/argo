import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from 'storybook/test'

import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { SessionsSidebar } from '../components/SessionsSidebar'
import { SessionScreenView } from './SessionScreenView'

const meta: Meta<typeof SessionScreenView> = {
  title: 'Sessions/Screen',
  component: SessionScreenView,
  args: {
    sessionLocation: '/Users/x/proj main',
    sessionTitle: 'The ink of a row nobody is waiting on',
  },
  decorators: [
    (Story) => (
      <div className="h-dvh w-full">
        <CockpitShell sidebar={<SessionsSidebar />}>
          <Story />
        </CockpitShell>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionScreenView>

export const InspectorControls: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const inspector = canvas.getByLabelText('Session inspector')
    const sessionsSidebar = canvas.getByLabelText('Sessions sidebar')
    const [cockpitSidebarResizeHandle, inspectorResizeHandle] = canvas.getAllByRole('separator')
    const initialInspectorWidth = inspector.getBoundingClientRect().width

    if (cockpitSidebarResizeHandle === undefined || inspectorResizeHandle === undefined) {
      throw new Error('The composed Sessions screen must render both resize handles.')
    }

    await expect(canvas.getByLabelText('Sessions sidebar')).toBeInTheDocument()

    const resizeHandleRectangle = inspectorResizeHandle.getBoundingClientRect()
    await userEvent.pointer([
      {
        target: inspectorResizeHandle,
        keys: '[MouseLeft>]',
        coords: { x: resizeHandleRectangle.x, y: resizeHandleRectangle.y + resizeHandleRectangle.height / 2 },
      },
      { coords: { x: resizeHandleRectangle.x - 64, y: resizeHandleRectangle.y + resizeHandleRectangle.height / 2 } },
      { keys: '[/MouseLeft]' },
    ])
    await expect(inspector.getBoundingClientRect().width).toBeGreaterThan(initialInspectorWidth)

    const snappedHandleRectangle = inspectorResizeHandle.getBoundingClientRect()
    await userEvent.pointer([
      {
        target: inspectorResizeHandle,
        keys: '[MouseLeft>]',
        coords: { x: snappedHandleRectangle.x, y: snappedHandleRectangle.y + snappedHandleRectangle.height / 2 },
      },
      { coords: { x: snappedHandleRectangle.x + 640, y: snappedHandleRectangle.y + snappedHandleRectangle.height / 2 } },
      { keys: '[/MouseLeft]' },
    ])
    await expect(inspector.getBoundingClientRect().width).toBe(0)
    await expect(sessionsSidebar.getBoundingClientRect().width).toBeGreaterThan(0)

    await userEvent.click(canvas.getByRole('button', { name: 'Open Session inspector' }))
    await expect(inspector.getBoundingClientRect().width).toBeGreaterThan(0)

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
    await expect(inspector.getBoundingClientRect().width).toBe(0)
  },
}
