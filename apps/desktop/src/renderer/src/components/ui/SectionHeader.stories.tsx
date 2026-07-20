import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SectionHeader } from './SectionHeader'

const meta = {
  title: 'Cockpit/SectionHeader',
  component: SectionHeader,
  decorators: [
    (Story): React.JSX.Element => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    label: { control: 'text' },
    count: { control: 'text' },
  },
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

// A count is not always a number — the Checks header counts a sha and a phrase, which is
// why it drops the eyebrow's uppercase and tracking.
export const Default: Story = {
  args: { label: 'Checks', count: '8f3a1c +2 uncommitted' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('· 8f3a1c +2 uncommitted')).toBeInTheDocument()
  },
}

// `count` is optional and its absence is a different render, not a different value.
export const WithoutCount: Story = {
  args: { label: 'Background Tasks' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Background Tasks')).toBeInTheDocument()
    await expect(canvas.queryByText('·', { exact: false })).not.toBeInTheDocument()
  },
}
