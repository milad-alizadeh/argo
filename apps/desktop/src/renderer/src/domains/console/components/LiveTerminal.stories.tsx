import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { LIVE_CHANNEL_LABEL } from './consoleChannels'
import { LiveTerminal } from './LiveTerminal'

const meta = {
  title: 'Console/LiveTerminal',
  component: LiveTerminal,
} satisfies Meta<typeof LiveTerminal>

export default meta
type Story = StoryObj<typeof meta>

// The terminal paints NO background of its own — it reads through to the panel it sits on.
// A busy field behind a frosted panel makes that visible: the panel blurs the colour behind
// it, and the shell's text floats on the glass (no glass on glass). No shell is attached in
// Storybook, so the surface shows the canned preview prompt.
export const OnGlassPanel: Story = {
  decorators: [
    (Story): React.JSX.Element => (
      <div className="relative flex h-72 w-2xl items-stretch overflow-hidden bg-background p-6">
        {/* Colour behind the glass so the frost has something to blur. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="-left-8 absolute top-4 h-40 w-40 rounded-full bg-tone-run/40 blur-2xl" />
          <div className="absolute right-2 bottom-0 h-48 w-48 rounded-full bg-primary/30 blur-2xl" />
          <div className="absolute top-1/2 left-1/3 h-32 w-56 rounded-full bg-foreground/20 blur-2xl" />
        </div>
        <section className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl backdrop-blur-xl">
          <Story />
        </section>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement).getByRole('tabpanel', { name: LIVE_CHANNEL_LABEL })
    await expect(panel).toBeInTheDocument()
    // No background of its own: the panel glass is what shows through.
    await expect(getComputedStyle(panel).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  },
}
