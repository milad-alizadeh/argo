import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { InspectorRow } from './InspectorRow'

const meta: Meta<typeof InspectorRow> = {
  title: 'Sessions/InspectorRow',
  component: InspectorRow,
  args: { children: 'Inspect the Session shell', status: 'running' },
  decorators: [
    (Story) => (
      <ul>
        <Story />
      </ul>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof InspectorRow>

export const Agent: Story = {}
export const Shell: Story = {
  args: { children: 'bun run typecheck', monospace: true, outlined: true },
}
