import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AgentPicker } from './AgentPicker'

const meta = {
  title: 'Shell/ConnectPanel/AgentPicker',
  component: AgentPicker,
  args: { cli: 'claude', onChoose: fn() },
  argTypes: {
    cli: {
      control: 'select',
      options: ['claude', 'codex'],
      description: 'The CLI a new session starts here.',
      table: { type: { summary: 'Cli' } },
    },
  },
} satisfies Meta<typeof AgentPicker>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The one thing Project Settings holds that onboarding does not.
 *
 * It is per project because nobody runs two editors at once, and it lives here rather than on
 * spawn so that ⌘N stays zero-config.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const picker = within(canvasElement)
    await userEvent.click(picker.getByRole('radio', { name: 'Codex' }))
    await expect(args.onChoose).toHaveBeenCalledWith('codex')
  },
}

/**
 * Pressing the CLI already in force.
 *
 * Radix reports a toggled-off item as no selection at all, which a project can never be in —
 * something has to run — so the press is ignored rather than written as "no agent".
 */
export const Reselected: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('radio', { name: 'Claude Code' }))
    await expect(args.onChoose).not.toHaveBeenCalled()
  },
}
