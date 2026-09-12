import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { CockpitShell } from '../../cockpit/components/CockpitShell'
import { SessionsSidebar } from '../components/SessionsSidebar'
import { SessionScreenView } from './SessionScreenView'

const meta: Meta<typeof SessionScreenView> = {
  title: 'Sessions/Screen',
  component: SessionScreenView,
  parameters: {
    layout: 'fullscreen',
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

export const Overview: Story = {}

export const SidebarInteractions: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const inspector = canvas.getByLabelText('Session inspector')
    const initialInspectorRectangle = inspector.getBoundingClientRect()
    const initialInspectorWidth = initialInspectorRectangle.width
    const initialInspectorRight = initialInspectorRectangle.right
    const inspectorMinimumWidth = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--size-session-inspector-min'),
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Sessions sidebar' }))
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Open Sessions sidebar' })).toBeInTheDocument())
    await expect(inspector.getBoundingClientRect().width).toBeCloseTo(
      Math.max(initialInspectorWidth, inspectorMinimumWidth),
      0,
    )
    await expect(inspector.getBoundingClientRect().right).toBeCloseTo(initialInspectorRight, 0)
    await userEvent.click(canvas.getByRole('button', { name: 'Open Sessions sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Sessions sidebar' })).toBeInTheDocument(),
    )
  },
}

export const InspectorInteractions: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const inspector = canvas.getByLabelText('Session inspector')
    const sessionsSidebar = canvas.getByLabelText('Sessions sidebar')
    const [, inspectorResizeHandle] = canvas.getAllByRole('separator')
    const initialInspectorWidth = inspector.getBoundingClientRect().width

    if (inspectorResizeHandle === undefined) {
      throw new Error('The composed Sessions screen must render an inspector resize handle.')
    }

    await userEvent.click(inspectorResizeHandle)
    await userEvent.keyboard('{ArrowLeft}')
    await expect(inspector.getBoundingClientRect().width).toBeGreaterThan(initialInspectorWidth)

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
    await expect(sessionsSidebar.getBoundingClientRect().width).toBeGreaterThan(0)

    await waitFor(() => expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeInTheDocument())
    await userEvent.click(canvas.getByRole('button', { name: 'Open Session inspector' }))
    await expect(canvas.getByRole('button', { name: 'Expand Session sidebar' })).toBeInTheDocument()
  },
}

export const WorkspaceInteractions: Story = {
  tags: ['!autodocs'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const workspace = canvas.getByLabelText('Session feed').parentElement
    if (workspace === null) throw new Error('The Session workspace must render its feed boundary.')

    await userEvent.click(canvas.getByRole('button', { name: 'Expand Session sidebar' }))
    await expect(workspace.getBoundingClientRect().width).toBe(0)

    await userEvent.click(canvas.getByRole('button', { name: 'Restore Session sidebar' }))
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Expand Session sidebar' }),
      ).toBeInTheDocument(),
    )
  },
}
