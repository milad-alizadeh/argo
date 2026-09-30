import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { sessionRow } from '@/mocks/sessions/session-rows'
import { installSessionHost, type SessionHost } from '@/mocks/sessions/session-story-host'
import { useLinkedSessions } from '../hooks/use-linked-sessions'
import { LinkedSessions } from './ticket-detail-linked-sessions'

const TICKET_KEY = '#607'
// More than one 30-row page of the Session List.
const LINKED = Array.from({ length: 45 }, (_unused, index) =>
  sessionRow({
    id: `linked-${index}`,
    archived: index === 0,
    title: { text: `Linked Session ${index}`, source: 'first-prompt' },
    name: `Linked Session ${index}`,
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

let host: SessionHost

// A Ticket linked to more Sessions than one page holds lists every one of them, archived or not.
export const EveryPageOfLinkedSessions: Story = {
  beforeEach: () => {
    host = installSessionHost(LINKED)
    return host
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getAllByRole('button')).toHaveLength(LINKED.length))
    await expect(canvas.getByText('Linked Session 44')).toBeVisible()
    await expect(canvas.getByText('Linked Session 0')).toBeVisible()
    await expect(canvas.getByText(`Linked Sessions · ${LINKED.length}`)).toBeVisible()
    for (const read of host.reads)
      await expect(read).toMatchObject({ ticketKey: TICKET_KEY, filter: 'all' })
  },
}
