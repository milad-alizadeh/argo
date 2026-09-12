import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { RosterNotice } from './RosterNotice'

const meta: Meta<typeof RosterNotice> = {
  title: 'Sessions/RosterNotice',
  component: RosterNotice,
  args: { failure: 'EACCES: permission denied', onReread: () => undefined },
}

export default meta
type Story = StoryObj<typeof RosterNotice>

export const FailedReread: Story = {}
