import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import type { SessionView } from '@/sessionStore'
import { Rail } from './Rail'

const meta = {
  title: 'Cockpit/Rail',
  component: Rail,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Rail>

export default meta
type Story = StoryObj<typeof meta>

// Empty hub → empty rail (issue #3): the whole visible surface is the empty state.
export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No Sessions observed yet.')).toBeInTheDocument()
    await expect(canvas.queryByRole('list', { name: 'Sessions' })).not.toBeInTheDocument()
  },
}

const oneSession: SessionView[] = [
  { id: 'demo-claude-1', title: 'Refactor auth module', cli: 'claude', status: 'working' },
]

// A single projected Session → one rail row, asserting the whole visible row.
export const SingleSession: Story = {
  args: { sessions: oneSession },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('list', { name: 'Sessions' })
    await expect(within(list).getByText('Refactor auth module')).toBeInTheDocument()
    await expect(within(list).getByText('claude')).toBeInTheDocument()
    await expect(within(list).getByRole('img', { name: 'Working' })).toBeInTheDocument()
    await expect(canvas.queryByText('No Sessions observed yet.')).not.toBeInTheDocument()
  },
}
