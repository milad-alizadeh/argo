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
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const LabelOnly: Story = {
  args: { label: 'Background Tasks' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Background Tasks')).toBeInTheDocument()
    await expect(canvas.queryByText('·', { exact: false })).not.toBeInTheDocument()
  },
}

export const NumericCount: Story = {
  args: { label: 'Outcomes', count: 4 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('· 4')).toBeInTheDocument()
  },
}

export const ZeroCount: Story = {
  args: { label: 'Findings', count: 0 },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('· 0')).toBeInTheDocument()
  },
}

// A count is not always a number — the Checks header counts a sha.
export const TextCount: Story = {
  args: { label: 'Checks', count: '8f3a1c +2 uncommitted' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('· 8f3a1c +2 uncommitted')).toBeInTheDocument()
  },
}

export const WithTrailing: Story = {
  args: { label: 'Checks', count: '8f3a1c', trailing: 'Argo · this working tree' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Argo · this working tree')).toBeInTheDocument()
  },
}

export const TrailingWithoutCount: Story = {
  args: { label: 'Artifacts', trailing: '3' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('3')).toBeInTheDocument()
  },
}
