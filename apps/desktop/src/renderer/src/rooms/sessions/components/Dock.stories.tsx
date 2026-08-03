import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { EXTERNAL, interiorOf, RUNNING } from '../__fixtures__/interior'
import { Dock } from './Dock'

const meta = {
  title: 'Sessions/Dock',
  component: Dock,
  parameters: { layout: 'fullscreen' },
  args: { dock: interiorOf(RUNNING).dock, expanded: false, onToggleExpanded: fn() },
  argTypes: {
    dock: { control: false, table: { type: { summary: 'DockModel' } } },
    attach: { control: false, table: { type: { summary: 'TerminalAttach' } } },
  },
  // The Dock sizes off the screen-local `--r-dock` the splitter drives, so the decorator pins it.
  decorators: [
    (Story) => (
      <div
        className="flex h-screen w-screen flex-col justify-end bg-panel"
        style={{ '--r-dock': '170px' }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Dock>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The Dock as it always is: present, with the now-head in its own header row and a real terminal
 * beneath. There is no Stop button and no steer widget anywhere in it — you type at the prompt and
 * stop with Ctrl-C, which is why the header row's only control is the expand caret.
 */
export const Docked: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Bash bun run typecheck')).toBeInTheDocument()
    await expect(canvas.getByRole('region', { name: 'Session terminal' })).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument()
    const [caret] = canvas.getAllByRole('button')
    await expect(caret).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(caret as HTMLElement)
    await expect(args.onToggleExpanded).toHaveBeenCalled()
  },
}

/** Expanded: the same surface, taller. Expanding never opens a second one. */
export const Expanded: Story = {
  args: { expanded: true },
  decorators: [
    (Story) => (
      <div
        className="flex h-screen w-screen flex-col justify-end bg-panel"
        style={{ '--r-dock': '320px' }}
      >
        <Story />
      </div>
    ),
  ],
}

/**
 * An external session has no PTY: Argo did not launch it, so the Dock replays its transcript and says
 * so rather than offering a prompt that could steer nothing.
 */
export const NoPtyToSteer: Story = {
  args: { dock: interiorOf(EXTERNAL).dock },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/read-only — external session/)).toBeInTheDocument()
    await expect(canvas.queryByRole('region', { name: 'Session terminal' })).not.toBeInTheDocument()
  },
}
