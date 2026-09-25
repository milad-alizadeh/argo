import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SectionTitle } from './section-title'

const meta = {
  title: 'Components/Section Title',
  component: SectionTitle,
  parameters: { layout: 'padded' },
  args: { children: 'Ready outside this path' },
} satisfies Meta<typeof SectionTitle>

export default meta
type Story = StoryObj<typeof meta>

export const Text: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Ready outside this path',
    )
  },
}

export const WithIcon: Story = {
  args: { icon: 'sparkles' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Ready outside this path',
    )
    await expect(canvasElement.querySelector('[data-slot="icon"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  },
}

export const Level: Story = {
  args: { as: 'h4' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 4 })).toBeVisible()
  },
}
