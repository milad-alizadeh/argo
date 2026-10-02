import type { Meta, StoryObj } from '@storybook/react-vite'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from './empty'

const meta = { title: 'Design System/Primitives/Empty', component: Empty } satisfies Meta<typeof Empty>
export default meta
type Story = StoryObj<typeof meta>

export const NoResults: Story = {
  render: () => <Empty><EmptyHeader><EmptyTitle>No matching projects</EmptyTitle><EmptyDescription>Try a different name.</EmptyDescription></EmptyHeader><EmptyContent>Projects appear here when they match your search.</EmptyContent></Empty>,
  tags: ['view-only'],
}
