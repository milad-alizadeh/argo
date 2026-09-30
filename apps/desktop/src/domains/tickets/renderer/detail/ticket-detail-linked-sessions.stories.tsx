import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { sessionRow } from '@/mocks/sessions/session-rows'
import { installSessionHost } from '@/mocks/sessions/session-story-host'
import { useLinkedSessions } from '../hooks/use-linked-sessions'
import { LinkedSessions } from './ticket-detail-linked-sessions'

const TICKET_KEY = '#607'
// More than one 30-row page of the Session List.
const LINKED = Array.from({ length: 45 }, (_unused, index) =>
  sessionRow({
    id: `linked-${index}`,
    title: { text: `Linked Session ${index}`, source: 'first-prompt' },
    ticket: {
      projectId: 'storybook-project',
      key: TICKET_KEY,
      title: 'Page the Session List',
      state: 'open',
      createdAt: '2026-09-30T00:00:00.000Z',
    },
  }),
)

function TicketSessions({ onOpenSession }: { onOpenSession: (id: string) => void }) {
  return (
    <LinkedSessions
      onOpenSession={onOpenSession}
      sessions={useLinkedSessions('storybook-project', TICKET_KEY)}
    />
  )
}

const meta = {
  title: 'Tickets/Ticket Detail/Linked Sessions',
  component: TicketSessions,
  args: { onOpenSession: fn() },
} satisfies Meta<typeof TicketSessions>

export default meta
type Story = StoryObj<typeof meta>

// A Ticket linked to more Sessions than one page holds lists every one of them.
export const EveryPageOfLinkedSessions: Story = {
  beforeEach: () => installSessionHost(LINKED),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getAllByRole('button')).toHaveLength(LINKED.length))
    await expect(canvas.getByText('Linked Session 44')).toBeVisible()
    await expect(canvas.getByText(`Linked Sessions · ${LINKED.length}`)).toBeVisible()
  },
}
