import type { Meta, StoryObj } from '@storybook/react'
import { AgentsRail } from './AgentsRail'
import { partialSessionStory, sessionStory, workingSessionStory } from './stories.fixtures'

const meta: Meta<typeof AgentsRail> = {
  title: 'Sessions/AgentsRail',
  component: AgentsRail,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="h-80 w-[220px] border-r bg-background">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof AgentsRail>

// Two Subagents running, one named by what it was asked and one by its place, and one home.
export const Running: Story = { args: { session: workingSessionStory } }
// Delegated once, and the result came back.
export const Finished: Story = { args: { session: sessionStory } }
// A Session whose state Argo cannot place: its open delegation is unresolved, never running.
export const Unknown: Story = { args: { session: partialSessionStory } }
