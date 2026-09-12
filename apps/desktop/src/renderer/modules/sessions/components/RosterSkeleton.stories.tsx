import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { RosterSkeleton } from './RosterSkeleton'

const meta: Meta<typeof RosterSkeleton> = {
  title: 'Sessions/RosterSkeleton',
  component: RosterSkeleton,
}

export default meta
type Story = StoryObj<typeof RosterSkeleton>

export const Loading: Story = {}
