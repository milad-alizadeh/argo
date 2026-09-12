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

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sessionsSidebar = canvas.getByLabelText('Sessions sidebar')

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Sessions sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Sessions sidebar' })).toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open Sessions sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Collapse Sessions sidebar' })).toBeInTheDocument(),
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Collapse Session inspector' }))
    await expect(sessionsSidebar.getBoundingClientRect().width).toBeGreaterThan(0)

    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Open Session inspector' })).toBeInTheDocument(),
    )
    await userEvent.click(canvas.getByRole('button', { name: 'Open Session inspector' }))
    await expect(canvas.getByRole('button', { name: 'Expand Session sidebar' })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Expand Session sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Restore Session sidebar' })).toBeInTheDocument(),
    )

    await userEvent.click(canvas.getByRole('button', { name: 'Restore Session sidebar' }))
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Expand Session sidebar' })).toBeInTheDocument(),
    )
  },
}
