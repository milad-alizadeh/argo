import { type SessionPosture, type SessionStatus, sessionFacts } from '@shared'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { DOT_GLOWS, deliveryState, ROSTER_TONES } from '@/shared/status'
import { StatusDot } from './StatusDot'
import { Text } from './Text'

const meta = {
  title: 'Shared/StatusDot',
  component: StatusDot,
  argTypes: {
    tone: { control: 'select', options: ROSTER_TONES },
    hollow: { control: 'boolean' },
    glow: { control: 'select', options: DOT_GLOWS },
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
 * A breathing dot. Pulse is a property of the STATE — a session still moving breathes and one that
 * has come to rest holds still — so several may breathe at once. Asserting the computed
 * animation, not just the class, is what catches the utility failing to resolve.
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
 * its state, so it renders as a ring with nothing inside it — lit at the faintest weight, which
 * is as much as an unclaimed state earns.
 */
export const Hollow: Story = {
  args: { tone: 'gray', label: 'Read-only', hollow: true, glow: 'faint' },
  play: async ({ canvasElement }) => {
    const ring = getComputedStyle(within(canvasElement).getByRole('img', { name: 'Read-only' }))
    await expect(ring.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    await expect(ring.borderTopWidth).not.toBe('0px')
    await expect(ring.boxShadow).not.toBe('none')
  },
}

/**
 * Weighted down for a state at rest. Every dot glows — brightness is what liveness is spelled in,
 * so a resting state is dimmer rather than unlit, and only the weight changes.
 */
export const Quiet: Story = {
  args: { tone: 'gray', label: 'Idle', glow: 'quiet' },
  play: async ({ canvasElement }) => {
    const quiet = getComputedStyle(within(canvasElement).getByRole('img', { name: 'Idle' }))
    await expect(quiet.boxShadow).not.toBe('none')
  },
}

// The five states the rail can draw, each with its tone, glow weight and pulse read off the one
// derivation — a story cannot show a dot the model would not produce.
const RAIL_STATES: readonly [SessionStatus, SessionPosture][] = [
  ['running', 'managed'],
  ['asking', 'managed'],
  ['idle', 'managed'],
  ['stopped', 'managed'],
  ['running', 'external'],
]

/**
 * Every state the rail draws, with its motion truth: running and needs-you burn bright and breathe,
 * failed burns just as bright but holds still, idle stays lit and quiet, and the observed row is a
 * faint hollow ring. The gallery is where "one thing shouting" is judged, so the animating dots are
 * masked for pixel diffing. That each of these dots resolves its animation is `Pulsing`'s claim, and
 * which state breathes at all is `rosterStatus.test.ts`'s.
 */
export const EveryState: Story = {
  args: { tone: 'run' },
  render: () => (
    <div className="flex items-start gap-region" data-vrt-mask>
      {RAIL_STATES.map(([status, posture]) => {
        const { word, dot } = deliveryState(sessionFacts({ status }), posture).rail
        return (
          <span className="flex w-20 flex-col items-center gap-gap" key={word}>
            <StatusDot {...dot} />
            <Text variant="meta" className="text-foreground-faint">
              {word}
            </Text>
          </span>
        )
      })}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const word of ['running', 'needs you', 'idle', 'failed', 'read-only']) {
      await expect(canvas.getByText(word)).toBeInTheDocument()
    }
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
