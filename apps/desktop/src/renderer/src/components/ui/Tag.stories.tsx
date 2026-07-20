import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Tag, type TagTone } from './Tag'

const TONES: TagTone[] = ['neutral', 'warn', 'primary']

const meta = {
  title: 'Cockpit/Tag',
  component: Tag,
  argTypes: {
    tone: { control: 'select', options: TONES },
    label: { control: 'text' },
  },
} satisfies Meta<typeof Tag>

export default meta
type Story = StoryObj<typeof meta>

// The label is authored lower-case and the type role uppercases it, so the accessible
// text stays what the caller wrote.
export const Default: Story = {
  args: { label: 'worktree', tone: 'neutral' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('worktree')).toBeInTheDocument()
  },
}

export const AllTones: Story = {
  args: { label: 'worktree', tone: 'neutral' },
  render: () => (
    <div className="flex items-center gap-gap">
      <Tag label="main tree" tone="neutral" />
      <Tag label="uncommitted" tone="warn" />
      <Tag label="declared" tone="primary" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('declared')).toBeInTheDocument()
  },
}
