import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { sessionShellCommand } from '../session-fixtures'
import { SessionShellInspector } from './SessionShellInspector'

const NOW = Date.parse('2026-09-02T08:05:00.000Z')

const WATCH = sessionShellCommand({
  id: 'call-watch',
  command: 'npm run watch',
  background: true,
  startedAt: '2026-09-02T08:00:30.000Z',
  outputPath: '/tmp/argo-shell/watch.output',
})

const meta: Meta<typeof SessionShellInspector> = {
  title: 'Sessions/Screen/Shell Inspector',
  component: SessionShellInspector,
  parameters: { layout: 'fullscreen' },
  args: { now: NOW, onBack: fn() },
  decorators: [
    (Story) => (
      <div className="flex h-dvh w-(--size-session-inspector) flex-col bg-sidebar">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionShellInspector>

export const Running: Story = {
  args: { command: WATCH, output: 'watching for changes\nrebuilt in 240ms\n' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('npm run watch')).toHaveLength(2)
    await expect(canvas.getByText('Running · 4m 30s')).toBeVisible()
    await expect(canvas.getByText(/rebuilt in 240ms/)).toBeVisible()
  },
}

export const Completed: Story = {
  args: {
    command: sessionShellCommand({
      id: 'call-build',
      command: 'bun run build',
      background: true,
      state: 'completed',
      startedAt: '2026-09-02T08:01:00.000Z',
      endedAt: '2026-09-02T08:01:43.000Z',
      result: 'Background command "bun run build" completed (exit code 0)',
    }),
    output: 'building\ndone in 43s\n',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Completed · 43s · .*exit code 0/)).toBeVisible()
    await expect(canvas.getByText(/done in 43s/)).toBeVisible()
  },
}

export const NoRecordedOutput: Story = {
  args: { command: WATCH, output: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('This command recorded no output.')).toBeVisible()
  },
}

export const GoesBackToTheRail: Story = {
  args: { command: WATCH, output: 'watching for changes\n' },
  play: async ({ args, canvasElement }) => {
    const back = within(canvasElement).getByRole('button', { name: 'Back' })
    back.focus()
    await expect(back).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onBack).toHaveBeenCalled()
  },
}
