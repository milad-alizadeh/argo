import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, within } from 'storybook/test'
import type { TicketPriority, TicketStatus } from '@/domains/tickets/api/ticket'
import {
  PriorityIcon,
  StatusIcon,
  StatusMark,
} from './ticket-status'

const CATEGORY_STATUS: Record<TicketStatus['category'], TicketStatus> = {
  triage: { id: 'triage', category: 'triage', name: 'Triage' },
  backlog: { id: 'backlog', category: 'backlog', name: 'Backlog' },
  unstarted: { id: 'todo', category: 'unstarted', name: 'Todo' },
  started: { id: 'progress', category: 'started', name: 'In Progress' },
  completed: { id: 'done', category: 'completed', name: 'Done' },
  canceled: { id: 'canceled', category: 'canceled', name: 'Canceled' },
}

export const STATUS_SAMPLES: readonly TicketStatus[] = [
  ...Object.values(CATEGORY_STATUS),
  { id: 'review', category: 'started', name: 'In Review' },
]

export const PRIORITY_SAMPLES: readonly TicketPriority[] = [
  { level: 1, label: 'Urgent' },
  { level: 2, label: 'High' },
  { level: 3, label: 'Medium' },
  { level: 4, label: 'Low' },
]

export function TicketStatusSamples() {
  const identifier = React.useId()
  return (
    <div className="grid gap-4" id={identifier}>
      <ul className="grid gap-2">
        {STATUS_SAMPLES.map((status) => (
          <li data-status={status.id} key={status.id}>
            <StatusMark named status={status} />
          </li>
        ))}
      </ul>
      <ul className="grid gap-2">
        {[null, ...PRIORITY_SAMPLES].map((priority) => (
          <li
            className="flex items-center gap-2 text-xs"
            data-priority={priority?.level ?? 'none'}
            key={priority?.level ?? 'none'}
          >
            <PriorityIcon priority={priority} />
            {priority?.label ?? 'No priority'}
          </li>
        ))}
      </ul>
      <span className="flex items-center gap-2 text-xs">
        <StatusIcon current={2} status={CATEGORY_STATUS.started} statuses={STATUS_SAMPLES} total={4} />
        2 of 4 children complete
      </span>
    </div>
  )
}

const meta = {
  title: 'Features/Tickets/Status/Ticket Status',
  excludeStories: ['CATEGORY_STATUS', 'STATUS_SAMPLES', 'PRIORITY_SAMPLES', 'TicketStatusSamples'],
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
