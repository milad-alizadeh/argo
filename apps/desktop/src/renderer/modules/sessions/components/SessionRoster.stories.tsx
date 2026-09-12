import type { Meta, StoryObj } from '@storybook/react'

import '../screens/session-page.css'
import { SessionRoster } from './SessionRoster'
import { archivedSessionStory, sessionsStory } from './stories.fixtures'

const meta: Meta<typeof SessionRoster> = {
  title: 'Sessions/SessionRoster',
  component: SessionRoster,
  tags: ['autodocs'],
  args: {
    onCollapse: () => undefined,
    onSelect: () => undefined,
    onReread: () => undefined,
    projectName: 'argo',
    failure: null,
    loading: false,
  },
  // The pane takes its height from the surface it is given, so a story gives it one.
  decorators: [
    (Story) => (
      <div className="h-[560px] w-(--size-session-roster)">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionRoster>

export const Populated: Story = {
  args: { sessions: sessionsStory, selectedSessionId: null },
}
// The pass failed and replaced nothing: the rows below the head are the older pass's, and the
// button that asks for another one is still on the page.
export const FailedPass: Story = {
  args: {
    sessions: sessionsStory,
    selectedSessionId: sessionsStory[0]?.id ?? null,
    failure: 'Argo cannot read the Claude transcript folder.',
  },
}
// Enough archived Sessions to page: the section draws twenty and asks for the next twenty once
// the reader reaches the end of the ones on screen.
export const ManyArchived: Story = {
  args: {
    sessions: [
      ...sessionsStory,
      ...Array.from({ length: 45 }, (_row, index) => ({
        ...archivedSessionStory,
        id: `archived-${index}`,
        title: { text: `An archived Session, ${index + 1}`, source: 'first-prompt' as const },
      })),
    ],
    selectedSessionId: null,
  },
}
export const Empty: Story = { args: { sessions: [], selectedSessionId: null } }
