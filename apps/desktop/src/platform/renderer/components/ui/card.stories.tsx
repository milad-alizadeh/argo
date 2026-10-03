import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'

const meta = { title: 'Design System/Primitives/Card', component: Card } satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>

export const Content: Story = {
  render: () => <Card className="w-80"><CardHeader><CardTitle>Workspace</CardTitle><CardDescription>Project settings</CardDescription></CardHeader><CardContent>Argo desktop</CardContent></Card>,
  tags: ['view-only'],
}
