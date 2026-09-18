import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AtlasPage } from './atlas-page'

const meta: Meta<typeof AtlasPage> = {
  title: 'Atlas/Atlas Page',
  component: AtlasPage,
}

export default meta
type Story = StoryObj<typeof AtlasPage>

// The screen carries no content yet: the empty main is the shell's placement, not a bug.
export const Placeholder: Story = {
  play: async ({ canvasElement }) => {
    const main = within(canvasElement).getByRole('main')
    await expect(main).toBeEmptyDOMElement()
  },
}
