import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AtlasPage } from '@/domains/atlas/renderer/pages/atlas-page'

const meta = {
  title: 'Atlas/Atlas Page',
  component: AtlasPage,
} satisfies Meta<typeof AtlasPage>

export default meta
type Story = StoryObj<typeof AtlasPage>

// The screen carries no content yet: the empty main is the shell's placement, not a bug.
export const Placeholder: Story = {
  play: async ({ canvasElement }) => {
    const main = within(canvasElement).getByRole('main')
    await expect(main).toBeEmptyDOMElement()
  },
}
