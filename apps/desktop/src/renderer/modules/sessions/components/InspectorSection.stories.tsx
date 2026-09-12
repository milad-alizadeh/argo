import type { Meta, StoryObj } from '@storybook/react'
import '../screens/session-page.css'
import { InspectorRow } from './InspectorRow'
import { InspectorSection } from './InspectorSection'

const meta: Meta<typeof InspectorSection> = {
  title: 'Sessions/InspectorSection',
  component: InspectorSection,
  args: {
    label: 'Background agents · 1',
    children: <InspectorRow status="running">Read the shell</InspectorRow>,
  },
}

export default meta
type Story = StoryObj<typeof InspectorSection>

export const Agents: Story = {}
