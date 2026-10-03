import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { sessionShellCommand } from '@/mocks/sessions/session-rows'
import { AppPageHeader } from '@/platform/renderer/app/components/app-shell'
import { SessionWorkInspectorHeader } from '../work/session-work-inspector-header'
import { SessionShellInspector } from './session-shell-inspector'

const NOW = Date.parse('2026-09-02T08:05:00.000Z')

const WATCH = sessionShellCommand({
  id: 'call-watch',
  command: 'npm run watch',
  background: true,
  startedAt: '2026-09-02T08:00:30.000Z',
  outputPath: '/tmp/argo-shell/watch.output',
})

const meta = {
  title: 'Features/Sessions/Screens/Shell Inspector',
  component: SessionShellInspector,
  parameters: { layout: 'fullscreen' },
  args: { now: NOW },
  decorators: [
    (Story) => (
      <div className="panel-stack h-dvh w-(--size-session-inspector)">
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
      <AppPageHeader>
        <SessionWorkInspectorHeader
          work={{ kind: 'shell', command: args.command }}
          now={args.now}
        />
      </AppPageHeader>
      <aside
        role="presentation"
        className="panel-sidebar panel-outer-start panel-outer-end border border-border"
      >
        <SessionShellInspector {...args} />
      </aside>
    </>
  )
}

export const Running: Story = {
  args: { command: WATCH, output: 'watching for changes\nrebuilt in 240ms\n' },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    try {
      const canvas = within(canvasElement)
      await expect(canvas.getByText('npm run watch')).toBeVisible()
      await expect(canvas.getByText('Running · 4m 30s')).toBeVisible()
      await expect(canvas.getByText(/rebuilt in 240ms/)).toBeVisible()
      await userEvent.click(canvas.getByRole('button', { name: 'Copy terminal output' }))
      await expect(writeText).toHaveBeenCalledWith('watching for changes\nrebuilt in 240ms\n')
      await expect(await canvas.findByText('Copied to clipboard')).toBeInTheDocument()
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
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

export const EmptyOutput: Story = {
  args: { command: { ...WATCH, state: 'completed' }, output: '' },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('npm run watch')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Copy terminal output' })).toBeEnabled()
  },
}

export const AnsiOutput: Story = {
  args: {
    command: { ...WATCH, state: 'completed' },
    output: '\u001b[31mpackage build failed\u001b[0m\nretry the command\n',
  },
  render: (args) => <InspectorStory args={args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('package build failed')).toBeVisible()
    await expect(canvas.getByText(/retry the command/)).toBeVisible()
  },
}
