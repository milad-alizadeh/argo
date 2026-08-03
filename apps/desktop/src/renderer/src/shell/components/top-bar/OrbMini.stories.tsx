import type { Meta, StoryObj } from '@storybook/react-vite'
import { OrbMini } from './OrbMini'

const meta = {
  title: 'Shell/ConciergeStrip/OrbMini',
  component: OrbMini,
} satisfies Meta<typeof OrbMini>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The orb at rest — the only state it has in v1.
 *
 * This is the visual-diff surface for the ring's lit edge against the scene: the orb is the
 * scene's key light in the Penumbra reference, so its halo is the one place the bar spends the
 * primary. Everything that would make it expressive belongs to the voice-concierge map (issue 190).
 */
export const Default: Story = {}
