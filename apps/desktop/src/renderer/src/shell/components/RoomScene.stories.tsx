import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Text } from '@/shared/components/ui'
import { RoomScene } from './RoomScene'

const meta = {
  title: 'Shell/RoomScene',
  component: RoomScene,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RoomScene>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The light itself, with two planes standing in it so it can be judged for what it is for.
 *
 * The corona sits off-centre right, which is why the right-hand plane's lip and bloom read brighter
 * than the left one's — that difference IS the scene working. Judge it by whether the planes look
 * lit from somewhere, not by whether the gradient is pretty on its own.
 */
export const Lit: Story = {
  render: () => (
    <div className="relative h-screen w-screen">
      <RoomScene />
      <div className="flex h-full items-center justify-around p-plane">
        {['away from the light', 'under the corona'].map((where) => (
          <div key={where} className="plane grid h-64 w-72 place-items-center p-plane">
            <Text variant="row" className="text-foreground-soft">
              {where}
            </Text>
          </div>
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('under the corona')).toBeInTheDocument()
  },
}
