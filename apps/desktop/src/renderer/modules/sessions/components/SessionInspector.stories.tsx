import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { SessionInspector } from './SessionInspector'
import { workingSessionStory } from './stories.fixtures'

const meta: Meta<typeof SessionInspector> = {
  title: 'Sessions/SessionInspector',
  component: SessionInspector,
  args: { session: workingSessionStory, onCollapse: () => undefined },
  decorators: [
    (Story) => (
      <div className="h-[560px] w-(--size-session-inspector)">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionInspector>

export const Open: Story = {}
