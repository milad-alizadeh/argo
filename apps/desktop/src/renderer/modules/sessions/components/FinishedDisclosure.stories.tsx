import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { FinishedDisclosure } from './FinishedDisclosure'
import { workingSessionStory } from './stories.fixtures'

const meta: Meta<typeof FinishedDisclosure> = {
  title: 'Sessions/FinishedDisclosure',
  component: FinishedDisclosure,
  args: { session: workingSessionStory },
}

export default meta
type Story = StoryObj<typeof FinishedDisclosure>

export const Closed: Story = {}
