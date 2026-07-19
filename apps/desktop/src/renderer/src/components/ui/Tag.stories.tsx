import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Tag } from './Tag'

const meta = {
  title: 'Cockpit/Tag',
  component: Tag,
} satisfies Meta<typeof Tag>

export default meta
type Story = StoryObj<typeof meta>

const expectTag =
  (label: string): Story['play'] =>
  async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(label)).toBeInTheDocument()
  }

export const Neutral: Story = { args: { label: 'wt', tone: 'neutral' }, play: expectTag('wt') }
export const Warn: Story = {
  args: { label: 'uncommitted', tone: 'warn' },
  play: expectTag('uncommitted'),
}
export const Primary: Story = {
  args: { label: 'declared', tone: 'primary' },
  play: expectTag('declared'),
}

// The label is authored lower-case; the type role uppercases it, so the accessible text
// stays what the caller wrote.
export const MainTree: Story = {
  args: { label: 'main tree', tone: 'neutral' },
  play: expectTag('main tree'),
}

export const EmptyLabel: Story = {
  args: { label: '', tone: 'neutral' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('span')?.textContent).toBe('')
  },
}
