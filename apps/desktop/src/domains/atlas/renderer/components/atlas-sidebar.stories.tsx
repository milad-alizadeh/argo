import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AtlasSidebar } from '@/domains/atlas/renderer/components/atlas-sidebar'

const meta = {
  title: 'Atlas/Atlas Sidebar',
  component: AtlasSidebar,
} satisfies Meta<typeof AtlasSidebar>

export default meta
type Story = StoryObj<typeof AtlasSidebar>

// The sidebar carries no rows yet: the empty region is the shell's placement, not a bug.
export const Placeholder: Story = {
  play: async ({ canvasElement }) => {
    const sidebar = within(canvasElement).getByRole('complementary', { name: 'Atlas sidebar' })
    await expect(sidebar).toBeEmptyDOMElement()
  },
}
