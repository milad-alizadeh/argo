import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { StatusDot } from './StatusDot'

const meta = {
  title: 'Cockpit/StatusDot',
  component: StatusDot,
} satisfies Meta<typeof StatusDot>

export default meta
type Story = StoryObj<typeof meta>

// The status-keyed dot carries its status as an accessible name so it is legible
// without colour.
const expectStatus =
  (name: string): Story['play'] =>
  async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name })).toBeInTheDocument()
  }

const expectSilent: Story['play'] = async ({ canvasElement }) => {
  await expect(within(canvasElement).queryByRole('img')).not.toBeInTheDocument()
}

export const Working: Story = { args: { status: 'working' }, play: expectStatus('Working') }
export const Idle: Story = { args: { status: 'idle' }, play: expectStatus('Idle') }
export const AwaitingInput: Story = {
  args: { status: 'awaiting-input' },
  play: expectStatus('Awaiting input'),
}
export const Exited: Story = { args: { status: 'exited' }, play: expectStatus('Exited') }

// `decorative` suppresses the accessible name when a visible status word already labels
// the dot, so screen readers don't hear the status twice.
export const Decorative: Story = {
  args: { status: 'working', decorative: true },
  play: expectSilent,
}

export const ToneRun: Story = { args: { tone: 'run' }, play: expectSilent }
export const ToneAmber: Story = { args: { tone: 'amber' }, play: expectSilent }
export const ToneMist: Story = { args: { tone: 'mist' }, play: expectSilent }
export const ToneGray: Story = { args: { tone: 'gray' }, play: expectSilent }
export const ToneRed: Story = { args: { tone: 'red' }, play: expectSilent }
export const ToneStale: Story = { args: { tone: 'stale' }, play: expectSilent }
export const ToneLanded: Story = { args: { tone: 'landed' }, play: expectSilent }

// A tone-keyed dot standing alone names itself through `label`.
export const ToneLabelled: Story = {
  args: { tone: 'red', label: 'CI failing' },
  play: expectStatus('CI failing'),
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

export const NotPulsing: Story = {
  args: { tone: 'amber', label: 'Needs input', pulse: false },
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', { name: 'Needs input' })
    await expect(getComputedStyle(dot).animationName).toBe('none')
  },
}
