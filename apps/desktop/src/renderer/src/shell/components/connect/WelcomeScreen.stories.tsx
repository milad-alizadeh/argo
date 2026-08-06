import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { WelcomeScreen } from './WelcomeScreen'

const meta = {
  title: 'Shell/ConnectPanel/WelcomeScreen',
  component: WelcomeScreen,
  args: { onContinue: fn() },
} satisfies Meta<typeof WelcomeScreen>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The first thing a new user sees.
 *
 * Three benefit rows in plain language, no feature grid, and nothing asked for yet. The one
 * control moves on to the panel that actually creates the project.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const screen = within(canvasElement)
    await expect(screen.getByRole('heading', { name: 'Welcome to Argo' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Get started' }))
    await expect(args.onContinue).toHaveBeenCalled()
  },
}
