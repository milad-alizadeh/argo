import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SESSION_STATUS_NAMES, SessionToneSamples } from '@/mocks/styling/session-tones'

const meta = {
  title: 'Sessions/SessionList/SessionRow',
  component: SessionToneSamples,
  args: { onSelect: fn() },
} satisfies Meta<typeof SessionToneSamples>
export default meta
type Story = StoryObj<typeof meta>

export const States: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of Object.values(SESSION_STATUS_NAMES)) {
      await expect(canvas.getByRole('button', { name: new RegExp(name) })).toBeVisible()
    }
    await expect(canvas.getAllByText('Needs input')).toHaveLength(2)
    const question = canvas.getByRole('button', { name: /Question Session/ })
    await expect(question.querySelector('button, a')).toBeNull()
    await userEvent.click(question)
    await expect(args.onSelect).toHaveBeenCalledWith('asking')
  },
}
