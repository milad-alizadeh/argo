import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from './empty'

const meta = { title: 'Foundations/Primitives/Empty', component: Empty } satisfies Meta<typeof Empty>
export default meta
type Story = StoryObj<typeof meta>

export const NoResults: Story = {
  render: () => <Empty><EmptyHeader><EmptyTitle>No matching projects</EmptyTitle><EmptyDescription>Try a different name.</EmptyDescription></EmptyHeader><EmptyContent>Projects appear here when they match your search.</EmptyContent></Empty>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No matching projects')).toBeVisible()
    await expect(canvas.getByText('Try a different name.')).toBeVisible()
  },
}
