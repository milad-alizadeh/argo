import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { RosterBar } from './RosterBar'

const meta: Meta<typeof RosterBar> = {
  title: 'Sessions/RosterBar',
  component: RosterBar,
  args: { onCollapse: () => undefined, projectName: 'argo' },
}

export default meta
type Story = StoryObj<typeof RosterBar>

export const Default: Story = {}
