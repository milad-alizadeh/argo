import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { Tabs } from '@/shared/components/ui'
import { EXTERNAL, interiorOf, RUNNING, withIntent } from '../__fixtures__/interior'
import { SessionHeader } from './SessionHeader'

const meta = {
  title: 'Sessions/SessionPlane/SessionHeader',
  component: SessionHeader,
  parameters: { layout: 'fullscreen' },
  args: { header: withIntent(RUNNING).header, onOpenIntent: fn() },
  argTypes: {
    header: { control: false, table: { type: { summary: 'SessionHeaderModel' } } },
  },
  decorators: [
    (Story) => (
      <Tabs defaultValue="activity" className="bg-panel">
        <Story />
      </Tabs>
    ),
  ],
} satisfies Meta<typeof SessionHeader>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The band as one thing: ring, title with its meta beside it on the right, tabs on the line below. This is the story that
 * proves the composition rather than any child's props — the tabs sit INSIDE the band, there is no
 * strip beneath it, and there is no button or `⋯` anywhere in it.
 */
export const OneBand: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Auth refactor' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('tab')).toHaveLength(2)
    // Glance only: the intent chip is the ONE control the band carries.
    await expect(canvas.getAllByRole('button')).toHaveLength(1)
  },
}

/**
 * The same band under a session Argo only observes: the ring is empty and reads `unknown`, and the
 * intent chip is gone, so the band carries no controls at all.
 */
export const Observed: Story = {
  args: { header: interiorOf(EXTERNAL).header },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'context unknown' })).toBeInTheDocument()
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}

/**
 * A long title has to give way somewhere: it truncates, so the ring keeps its size and the tabs keep
 * their place. Layout under pressure is the parent's to prove, not the title atom's.
 */
export const LongTitle: Story = {
  args: {
    header: {
      ...withIntent(RUNNING).header,
      title: 'Rotate the deploy key and re-derive every downstream binding across all three rooms',
    },
  },
}
