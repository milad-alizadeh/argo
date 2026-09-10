import type { Meta, StoryObj } from '@storybook/react'
import { SessionsEmptyState } from './SessionsEmptyState'

const meta: Meta<typeof SessionsEmptyState> = {
  title: 'Sessions/SessionsEmptyState',
  component: SessionsEmptyState,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof SessionsEmptyState>

// The whole screen stands on this only while there is no reading at all: a first pass still
// running, or a first pass that failed. A later failure is said in the Roster head instead, so the
// reader keeps the rows and the button that asks for another pass.
export const FirstPass: Story = { args: { title: "Argo is reading this machine's Sessions." } }
export const FirstPassFailed: Story = {
  args: { title: 'Argo cannot read the Claude transcript folder.' },
}
// The two the Roster draws inside itself: a machine with no Sessions on it, and an empty archive.
export const NoSessions: Story = {
  args: {
    title: 'No Sessions on this machine',
    description: 'Argo lists a Session here as soon as a CLI writes one.',
  },
}
export const NothingArchived: Story = {
  args: { title: 'Nothing archived', description: 'A Session you archive moves in here.' },
}
