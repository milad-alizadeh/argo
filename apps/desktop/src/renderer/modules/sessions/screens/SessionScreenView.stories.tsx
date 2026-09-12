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

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sessionsSidebar = canvas.getByLabelText('Sessions sidebar')

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument(),
    )

    const openInspector = canvas.queryByRole('button', { name: 'Open Session inspector' })
    if (openInspector) await userEvent.click(openInspector)
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Collapse Session inspector' }),
      ).toBeInTheDocument(),
    )
    const inspectorControl = canvas.getByRole('button', { name: 'Collapse Session inspector' })
    const inspectorControlLeft = inspectorControl.getBoundingClientRect().left
    await userEvent.click(inspectorControl)
    await expect(sessionsSidebar.getBoundingClientRect().width).toBeGreaterThan(0)

    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeInTheDocument(),
    )
    const openInspectorControl = canvas.getByRole('button', { name: 'Open Session inspector' })
    await expect(openInspectorControl.getBoundingClientRect().left).toBe(inspectorControlLeft)
    await userEvent.click(openInspectorControl)
    await expect(canvas.getByRole('button', { name: 'Expand Session sidebar' })).toBeInTheDocument()
    const expandInspectorControl = canvas.getByRole('button', { name: 'Expand Session sidebar' })
    const expandInspectorControlLeft = expandInspectorControl.getBoundingClientRect().left
    await userEvent.click(expandInspectorControl)
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Restore Session sidebar' })).toBeInTheDocument(),
    )
    await expect(
      canvas.getByRole('button', { name: 'Restore Session sidebar' }).getBoundingClientRect().left,
    ).toBe(expandInspectorControlLeft)

    await userEvent.click(canvas.getByRole('button', { name: 'Restore Session sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Expand Session sidebar' })).toBeInTheDocument(),
    )
  },
}
