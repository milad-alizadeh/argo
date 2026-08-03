import type { Meta, StoryObj } from '@storybook/react-vite'
import { WindowControls } from './WindowControls'

const meta = {
  title: 'Shell/TopBar/WindowControls',
  component: WindowControls,
} satisfies Meta<typeof WindowControls>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The reserve, on its own.
 *
 * It renders nothing visible on purpose: the traffic lights belong to the macOS window, and all
 * this holds is the space they need. There is exactly one story because there is exactly one
 * state — a reserve has nothing to vary.
 */
export const Default: Story = {}
