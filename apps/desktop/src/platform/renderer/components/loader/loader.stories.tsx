import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Loader } from './loader'

const meta = {
  title: 'Components/Loader',
  component: Loader,
  parameters: { layout: 'centered' },
  args: { 'aria-label': 'Loading' },
} satisfies Meta<typeof Loader>

export default meta
type Story = StoryObj<typeof meta>

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      <Loader aria-label="Loading meta" size="meta" />
      <Loader aria-label="Loading control" size="control" />
      <Loader aria-label="Loading standard" size="standard" />
      <Loader aria-label="Loading prominent" size="prominent" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const expectedSizes = [12, 16, 28, 40]
    const loaders = canvas.getAllByRole('status')

    await expect(loaders).toHaveLength(expectedSizes.length)
    for (const [index, loader] of loaders.entries()) {
      await expect(loader.getBoundingClientRect().width).toBe(expectedSizes[index])
      await expect(loader.getBoundingClientRect().height).toBe(expectedSizes[index])
    }
  },
}

export const Decorative: Story = {
  args: { 'aria-hidden': true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('status')).toBeNull()
  },
}
