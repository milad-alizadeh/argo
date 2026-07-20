import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { StatusDot } from './StatusDot'
import type { StatusTone } from './sessionStatus'
import { Text } from './Text'

const TONES: StatusTone[] = ['run', 'amber', 'mist', 'gray', 'red', 'stale', 'landed']

const meta = {
  title: 'Cockpit/StatusDot',
  component: StatusDot,
  argTypes: {
    status: { control: 'select', options: ['working', 'idle', 'awaiting-input', 'exited'] },
    tone: { control: 'select', options: TONES },
    decorative: { control: 'boolean' },
    pulse: { control: 'boolean' },
    label: { control: 'text' },
  },
} satisfies Meta<typeof StatusDot>

export default meta
type Story = StoryObj<typeof meta>

// Keyed by a Session's status, the dot carries that status as its accessible name, so it
// is legible without colour. This is the bare-dot surface — wherever a word is shown
// beside the state, the component is the Status molecule, not this.
export const Default: Story = {
  args: { status: 'working' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'Working' })).toBeInTheDocument()
  },
}

// `decorative` suppresses the accessible name when a visible word already labels the dot,
// so screen readers don't hear the status twice.
export const Decorative: Story = {
  args: { status: 'working', decorative: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).not.toBeInTheDocument()
  },
}

// Keyed by a raw tone instead, the dot is silent until `label` names it.
export const ByTone: Story = {
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
      {TONES.map((tone) => (
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
