import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from './progress'

const meta = { title: 'Foundations/Primitives/Progress' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Determinate: Story = {
  render: () => <Progress value={65}><ProgressLabel>Indexing files</ProgressLabel><ProgressTrack /><ProgressValue /></Progress>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Indexing files')).toBeVisible()
    await expect(canvas.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '65')
  },
}
