import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { ROSTER_TONES } from '@/shared/status'
import { StatusDot } from './StatusDot'
import { Text } from './Text'

const meta = {
  title: 'Shared/StatusDot',
  component: StatusDot,
  argTypes: {
    tone: { control: 'select', options: ROSTER_TONES },
    hollow: { control: 'boolean' },
    glow: { control: 'boolean' },
    pulse: { control: 'boolean' },
    label: { control: 'text' },
  },
} satisfies Meta<typeof StatusDot>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Beside a visible word the dot says nothing — the word is already the accessible name, so
 * announcing it twice is the bug. This is how the Status molecule renders it.
 */
export const Default: Story = {
  args: { tone: 'run' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).not.toBeInTheDocument()
  },
}

/** Standing alone, the dot needs `label` to be legible without colour. */
export const Labelled: Story = {
  args: { tone: 'red', label: 'CI failing' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'CI failing' })).toBeInTheDocument()
  },
}

/**
 * The screen's ONE animation budget — at most one pulsing dot per render. Asserting the
 * computed animation, not just the class, is what catches the utility failing to resolve.
 */
export const Pulsing: Story = {
  args: { tone: 'amber', label: 'Needs input', pulse: true },
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', { name: 'Needs input' })
    const animation = getComputedStyle(dot)
    await expect(animation.animationName).toBe('pulse-status')
    await expect(animation.animationDuration).toBe('2s')
  },
}

/**
 * A session Argo only observes: the dot keeps the row's identity and drops every claim about
 * its state, so it renders as a ring with nothing inside it.
 */
export const Hollow: Story = {
  args: { tone: 'gray', label: 'Read-only', hollow: true },
  play: async ({ canvasElement }) => {
    const ring = getComputedStyle(within(canvasElement).getByRole('img', { name: 'Read-only' }))
    await expect(ring.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    await expect(ring.borderTopWidth).not.toBe('0px')
  },
}

/**
 * The live glow, which `running` alone earns. Every other state renders the flat dot above —
 * an always-glowing dot spends attention on states that never asked for it.
 */
export const Glowing: Story = {
  args: { tone: 'run', label: 'Running', glow: true },
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', { name: 'Running' })
    await expect(getComputedStyle(dot).boxShadow).not.toBe('none')
  },
}

/** The whole tone union in one frame — the visual-diff surface for the palette. */
export const AllTones: Story = {
  args: { tone: 'run' },
  render: () => (
    <div className="flex items-start gap-region">
      {ROSTER_TONES.map((tone) => (
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
