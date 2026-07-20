import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { RAIL_TONES } from '@/ship'
import { StatusDot } from './StatusDot'
import { Text } from './Text'

const meta = {
  title: 'Cockpit/StatusDot',
  component: StatusDot,
  argTypes: {
    tone: { control: 'select', options: RAIL_TONES },
    pulse: { control: 'boolean' },
    label: { control: 'text' },
  },
} satisfies Meta<typeof StatusDot>

export default meta
type Story = StoryObj<typeof meta>

// Beside a visible word the dot says nothing — the word is already the accessible name, so
// announcing it twice is the bug. This is how the Status molecule renders it.
export const Default: Story = {
  args: { tone: 'run' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).not.toBeInTheDocument()
  },
}

// Standing alone, the dot needs `label` to be legible without colour.
export const Labelled: Story = {
  args: { tone: 'red', label: 'CI failing' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'CI failing' })).toBeInTheDocument()
  },
}

// The screen's ONE animation budget — at most one pulsing dot per render. Asserting the
// computed animation, not just the class, is what catches the utility failing to resolve.
export const Pulsing: Story = {
  args: { tone: 'amber', label: 'Needs input', pulse: true },
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', { name: 'Needs input' })
    const animation = getComputedStyle(dot)
    await expect(animation.animationName).toBe('pulse-status')
    await expect(animation.animationDuration).toBe('2s')
  },
}

// The whole tone union in one frame — the visual-diff surface for the palette and its glow.
export const AllTones: Story = {
  args: { tone: 'run' },
  render: () => (
    <div className="flex items-start gap-region">
      {RAIL_TONES.map((tone) => (
        <span className="flex w-16 flex-col items-center gap-gap" key={tone}>
          <StatusDot tone={tone} />
          <Text variant="meta" className="text-foreground-faint">
            {tone}
          </Text>
        </span>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('landed')).toBeInTheDocument()
  },
}
