import type { Meta, StoryObj } from '@storybook/react'

import '../screens/session-page.css'
import { SessionDeckHead } from './SessionDeckHead'
import { partialSessionStory, workingSessionStory } from './stories.fixtures'

const meta: Meta<typeof SessionDeckHead> = {
  title: 'Sessions/SessionDeckHead',
  component: SessionDeckHead,
  tags: ['autodocs'],
  args: {
    onShowInspector: () => undefined,
    onShowRoster: () => undefined,
    showInspectorToggle: false,
  },
}

export default meta
type Story = StoryObj<typeof SessionDeckHead>

// The selected Session's title, with where it runs at the trailing edge. A long path loses its
// start, because its tail tells two worktrees apart. Nothing selected is the screen's story.
export const Selected: Story = { args: { session: workingSessionStory } }
// No working directory on any record: said as absent, and no branch drawn.
export const PlaceUnknown: Story = { args: { session: partialSessionStory } }
