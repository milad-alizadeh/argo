import type { Meta, StoryObj } from '@storybook/react'

import { sessionStory } from './stories.fixtures'
import { SessionListItem } from './SessionListItem'

const meta: Meta<typeof SessionListItem> = {
  title: 'Sessions/SessionListItem',
  component: SessionListItem,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionListItem>

export const Default: Story = { args: { session: sessionStory, selected: false, onSelect: () => undefined } }
export const Selected: Story = { args: { session: sessionStory, selected: true, onSelect: () => undefined } }
