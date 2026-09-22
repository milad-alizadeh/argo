import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SessionShellInspector } from '@/domains/sessions/renderer/inspector/session-shell-inspector'
import { sessionShellCommand } from '@/domains/sessions/renderer/session-fixtures'
import { SessionWorkInspectorHeader } from '@/domains/sessions/renderer/work/session-work-inspector-header'

const NOW = Date.parse('2026-09-02T08:05:00.000Z')

const WATCH = sessionShellCommand({
  id: 'call-watch',
  command: 'npm run watch',
  background: true,
  startedAt: '2026-09-02T08:00:30.000Z',
  outputPath: '/tmp/argo-shell/watch.output',
})

const meta = {
  title: 'Sessions/Screen/Shell Inspector',
  component: SessionShellInspector,
  parameters: { layout: 'fullscreen' },
  args: { now: NOW },
  decorators: [
    (Story) => (
      <div className="flex h-dvh w-(--size-session-inspector) flex-col bg-sidebar">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SessionShellInspector>

export default meta
type Story = StoryObj<typeof SessionShellInspector>

function InspectorStory({ args }: { args: React.ComponentProps<typeof SessionShellInspector> }) {
  return (
    <>
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center border-b border-border/60 px-(--spacing-shell-item)">
        <SessionWorkInspectorHeader
          work={{ kind: 'shell', command: args.command }}
          now={args.now}
        />
      </header>
      <SessionShellInspector {...args} />
    </>
  )
}

export const Running: Story = {
  args: { command: WATCH, output: 'watching for changes\nrebuilt in 240ms\n' },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('npm run watch')).toBeVisible()
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
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Completed · 43s · .*exit code 0/)).toBeVisible()
    await expect(canvas.getByText(/done in 43s/)).toBeVisible()
  },
}

export const WithLabel: Story = {
  args: {
    command: sessionShellCommand({
      id: 'call-package',
      command: 'RTK_DISABLED=1 bun run package 2>&1 | tee /tmp/pkg.log',
      label: 'Package the Electron app',
      background: true,
      startedAt: '2026-09-02T08:00:30.000Z',
    }),
    output: 'packaging...\n',
  },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Package the Electron app')).toBeVisible()
    await expect(canvas.queryByText(/RTK_DISABLED=1/)).not.toBeInTheDocument()
  },
}
