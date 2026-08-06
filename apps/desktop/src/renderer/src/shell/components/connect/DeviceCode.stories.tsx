import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DeviceCode } from './DeviceCode'

const meta = {
  title: 'Shell/ConnectPanel/DeviceCode',
  component: DeviceCode,
  args: {
    prompt: {
      userCode: 'WDJB-MJHT',
      verificationUri: 'https://github.com/login/device',
      expiresIn: 900,
    },
  },
  argTypes: { prompt: { control: 'object', table: { type: { summary: 'DeviceCodePrompt' } } } },
} satisfies Meta<typeof DeviceCode>

export default meta
type Story = StoryObj<typeof meta>

/**
 * What the panel shows while it waits on the browser.
 *
 * The code is the largest thing on the card because typing it is the user's whole job here,
 * and the page it goes on is a real link rather than an instruction to go find it.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const card = within(canvasElement)
    await expect(card.getByText('WDJB-MJHT')).toBeVisible()
    await expect(card.getByRole('link')).toHaveAttribute('href', 'https://github.com/login/device')
  },
}
