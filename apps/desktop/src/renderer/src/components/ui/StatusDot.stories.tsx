import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { StatusDot } from './StatusDot'

const meta = {
  title: 'Cockpit/StatusDot',
  component: StatusDot,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StatusDot>

export default meta
type Story = StoryObj<typeof meta>

// The dot carries its status as an accessible name so it is legible without colour.
const expectStatus =
  (name: string): Story['play'] =>
  async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name })).toBeInTheDocument()
  }

export const Working: Story = { args: { status: 'working' }, play: expectStatus('Working') }
export const Idle: Story = { args: { status: 'idle' }, play: expectStatus('Idle') }
export const AwaitingInput: Story = {
  args: { status: 'awaiting-input' },
  play: expectStatus('Awaiting input'),
}
export const Exited: Story = { args: { status: 'exited' }, play: expectStatus('Exited') }
