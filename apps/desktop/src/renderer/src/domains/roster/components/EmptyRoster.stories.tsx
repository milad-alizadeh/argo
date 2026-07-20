import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { EmptyRoster } from './EmptyRoster'

const meta = {
  title: 'Roster/EmptyRoster',
  component: EmptyRoster,
} satisfies Meta<typeof EmptyRoster>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The roster before main has observed anything.
 *
 * The molecule takes no props, so there is exactly one render and no axis to vary — the
 * copy and the compass are the whole component. This pins the wording, which is the part a
 * rename can quietly change without any test noticing.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No Sessions observed yet.')).toBeInTheDocument()
  },
}
