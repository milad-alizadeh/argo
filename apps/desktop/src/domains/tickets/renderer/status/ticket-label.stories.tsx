import type { Meta } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { TicketLabel } from './ticket-label'

const labels = [
  { name: 'security', color: '000000' },
  { name: 'design', color: 'FFFFFF' },
  { name: 'bug', color: 'ff0000' },
  { name: 'enhancement', color: '00ff00' },
  { name: 'documentation', color: '0000ff' },
  { name: 'release', color: 'fbca04' },
  { name: 'triage', color: null },
  { name: 'customer-reported-accessibility-regression', color: '5319e7' },
]

const meta = {
  title: 'Features/Tickets/Ticket Label',
  component: TicketLabel,
  render: () => (
    <div className="flex max-w-2xl flex-wrap gap-2">
      {labels.map((label) => (
        <TicketLabel key={label.name} label={label} />
      ))}
    </div>
  ),
} satisfies Meta<typeof TicketLabel>

export default meta

export const ProviderColors = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement)
    for (const label of labels) {
      await expect(canvas.getByText(label.name)).toBeVisible()
    }
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(canvas.queryByRole('link')).toBeNull()
  },
}
