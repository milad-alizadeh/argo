import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { EmptyRoster } from './EmptyRoster'

const meta = {
  title: 'Roster/EmptyRoster',
  component: EmptyRoster,
} satisfies Meta<typeof EmptyRoster>

export default meta
type Story = StoryObj<typeof meta>

/** The one muted line the roster shows when nothing has been observed yet. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No Sessions observed yet.')).toBeInTheDocument()
  },
}
