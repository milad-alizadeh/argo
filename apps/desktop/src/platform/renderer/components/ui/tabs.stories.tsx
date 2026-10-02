import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const meta = { title: 'Design System/Primitives/Tabs', component: Tabs } satisfies Meta<typeof Tabs>
export default meta
type Story = StoryObj<typeof meta>

export const Selection: Story = {
  render: () => <Tabs defaultValue="overview"><TabsList aria-label="Project sections"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList><TabsContent value="overview">Project overview.</TabsContent><TabsContent value="activity">Recent activity.</TabsContent></Tabs>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const activity = canvas.getByRole('tab', { name: 'Activity' })
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Project overview.')
    await userEvent.click(activity)
    await expect(activity).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Recent activity.')
  },
}
