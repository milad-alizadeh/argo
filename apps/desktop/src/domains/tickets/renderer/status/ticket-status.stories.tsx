import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import {
  PRIORITY_SAMPLES,
  STATUS_SAMPLES,
  TicketStatusSamples,
} from '@/mocks/styling/ticket-status'

const meta = {
  title: 'Tickets/Status/Ticket Status',
  parameters: { layout: 'padded' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = {
  render: () => <TicketStatusSamples />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const status of STATUS_SAMPLES) {
      await expect(canvas.getByText(status.name, { exact: true })).toBeVisible()
    }
    for (const priority of PRIORITY_SAMPLES) {
      await expect(canvas.getByText(priority.label, { exact: true })).toBeVisible()
    }
    await expect(canvas.getByText('No priority', { exact: true })).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(canvas.queryByRole('link')).toBeNull()
  },
}
