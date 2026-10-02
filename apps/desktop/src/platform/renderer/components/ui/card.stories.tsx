import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'

const meta = { title: 'Foundations/Primitives/Card', component: Card } satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>

export const Content: Story = {
  render: () => <Card className="w-80"><CardHeader><CardTitle>Workspace</CardTitle><CardDescription>Project settings</CardDescription></CardHeader><CardContent>Argo desktop</CardContent></Card>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Workspace')).toBeVisible()
    await expect(canvas.getByText('Project settings')).toBeVisible()
    await expect(canvas.getByText('Argo desktop')).toBeVisible()
  },
}
