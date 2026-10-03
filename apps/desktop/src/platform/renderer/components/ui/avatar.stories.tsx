import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from './avatar'

const meta = { title: 'Design System/Primitives/Avatar', component: Avatar } satisfies Meta<typeof Avatar>
export default meta
type Story = StoryObj<typeof meta>

export const Fallback: Story = {
  render: () => <AvatarGroup><Avatar role="img" aria-label="Mira Chen"><AvatarFallback>MC</AvatarFallback></Avatar><Avatar role="img" aria-label="Noah Reed"><AvatarFallback>NR</AvatarFallback></Avatar><AvatarGroupCount>+3</AvatarGroupCount></AvatarGroup>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('img', { name: 'Mira Chen' })).toBeVisible()
    await expect(canvas.getByText('+3')).toBeVisible()
  },
}
