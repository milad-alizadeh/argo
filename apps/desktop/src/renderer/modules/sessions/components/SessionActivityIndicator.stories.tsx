import type { Meta, StoryObj } from '@storybook/react'
import '../feed/feed.css'
import { SessionActivityIndicator } from './SessionActivityIndicator'

const meta: Meta<typeof SessionActivityIndicator> = {
  title: 'Sessions/SessionActivityIndicator',
  component: SessionActivityIndicator,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionActivityIndicator>

// The history is being read or measured: shadcn's status Marker with a spinner, in the place
// the Feed's first row will take.
export const Reading: Story = { args: { label: 'Reading Session…', busy: true } }
// The read failed: the same Marker, in the destructive ink, carrying the reason.
export const Failed: Story = {
  args: { label: 'The transcript for this Session could not be opened.', busy: false },
}
