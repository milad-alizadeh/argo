import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Text } from '@/shared/components/ui'
import { BranchSelector } from './BranchSelector'

const TRACKING = [
  { caption: 'clean', ahead: 0, behind: 0 },
  { caption: 'ahead', ahead: 2, behind: 0 },
  { caption: 'behind', ahead: 0, behind: 1 },
  { caption: 'diverged', ahead: 2, behind: 1 },
]

const meta = {
  title: 'Shell/GitControls/BranchSelector',
  component: BranchSelector,
  args: { branch: 'main', ahead: 0, behind: 0 },
  argTypes: {
    ahead: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    behind: { control: { type: 'range', min: 0, max: 40, step: 1 } },
  },
} satisfies Meta<typeof BranchSelector>

export default meta
type Story = StoryObj<typeof meta>

/** A clean branch: the name, and nothing that claims a tracking distance it does not have.
 * Drag `ahead` / `behind` to see either count arrive. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('main')).toBeVisible()
    await expect(canvas.queryByText('↑0')).not.toBeInTheDocument()
    await expect(canvas.queryByText('↓0')).not.toBeInTheDocument()
  },
}

/** All four tracking states in one frame — the visual-diff surface for the two counts' tones
 * (ahead is yours to push, behind is origin's to pull) and for the clean branch showing neither. */
export const TrackingStates: Story = {
  render: () => (
    <div className="flex flex-col gap-region">
      {TRACKING.map(({ caption, ahead, behind }) => (
        <div className="flex items-center gap-gap" key={caption}>
          <Text variant="meta" className="w-16 text-foreground-faint">
            {caption}
          </Text>
          <BranchSelector branch="main" ahead={ahead} behind={behind} />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('↑2')).toHaveLength(2)
    await expect(canvas.getAllByText('↓1')).toHaveLength(2)
  },
}
