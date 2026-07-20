import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test'
import { cn } from '@/lib/utils'
import { PANE_ORIENTATIONS, PaneSplitter } from './PaneSplitter'
import { Text } from './Text'

const RAIL = { size: 248, min: 190, max: 360 }

const meta = {
  title: 'Cockpit/PaneSplitter',
  component: PaneSplitter,
  args: { orientation: 'v', ...RAIL, label: 'Rail width', onResize: fn() },
  argTypes: {
    orientation: { control: 'select', options: PANE_ORIENTATIONS },
    size: { control: { type: 'range', min: 92, max: 640, step: 1 } },
    min: { control: 'number' },
    max: { control: 'number' },
    invert: { control: 'boolean' },
    label: { control: 'text' },
  },
  // A splitter is a hairline between two panes, so it only has a size once something
  // holds it: the frame stands in for the panes it would sit between. The gallery brings
  // its own frames and opts out.
  decorators: [
    (Story, { args, parameters }) =>
      parameters.unframed ? (
        <Story />
      ) : (
        <div
          className={cn(
            'flex h-40 w-40 rounded-xl border border-inset-hair bg-inset',
            args.orientation === 'h' && 'flex-col',
          )}
        >
          <Story />
        </div>
      ),
  ],
} satisfies Meta<typeof PaneSplitter>

export default meta
type Story = StoryObj<typeof meta>

// Dragging reports the new clamped px size and nothing else — the screen-local custom
// property it feeds (`--c-rail`) belongs to SessionScreen, never to the splitter.
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const splitter = within(canvasElement).getByRole('separator', { name: 'Rail width' })

    await fireEvent.pointerDown(splitter, { clientX: 100, clientY: 100 })
    await fireEvent.pointerMove(window, { clientX: 140, clientY: 100 })
    await expect(args.onResize).toHaveBeenLastCalledWith(288)

    // Past the far end it reports the bound it ran into, not the pointer.
    await fireEvent.pointerMove(window, { clientX: 900, clientY: 100 })
    await expect(args.onResize).toHaveBeenLastCalledWith(360)
    await fireEvent.pointerUp(window)

    // Released, the pointer no longer resizes anything.
    await fireEvent.pointerMove(window, { clientX: 200, clientY: 100 })
    await expect(args.onResize).toHaveBeenLastCalledWith(360)
  },
}

// A drag-only splitter is unreachable by keyboard, so the arrows along its axis step it.
export const KeyboardResize: Story = {
  play: async ({ args, canvasElement }) => {
    const splitter = within(canvasElement).getByRole('separator', { name: 'Rail width' })
    await userEvent.tab()
    await expect(splitter).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    await expect(args.onResize).toHaveBeenLastCalledWith(264)
    await userEvent.keyboard('{ArrowLeft}')
    await expect(args.onResize).toHaveBeenLastCalledWith(232)

    // The cross-axis arrows stay free for scrolling.
    await userEvent.keyboard('{ArrowDown}')
    await expect(args.onResize).toHaveBeenCalledTimes(2)
  },
}

// The bar between two rows — the console's ribbon.
export const Horizontal: Story = {
  args: { orientation: 'h', size: 170, min: 92, max: 420, label: 'Console height' },
  play: async ({ args, canvasElement }) => {
    const splitter = within(canvasElement).getByRole('separator', { name: 'Console height' })
    await expect(splitter).toHaveAttribute('aria-orientation', 'horizontal')

    await fireEvent.pointerDown(splitter, { clientX: 100, clientY: 100 })
    await fireEvent.pointerMove(window, { clientX: 100, clientY: 130 })
    await expect(args.onResize).toHaveBeenLastCalledWith(200)
    await fireEvent.pointerUp(window)
  },
}

// `invert` is for the pane that sits AFTER its splitter (the console under its bar):
// dragging down shrinks it.
export const Inverted: Story = {
  args: { orientation: 'h', size: 170, min: 92, max: 420, invert: true, label: 'Console height' },
  play: async ({ args, canvasElement }) => {
    const splitter = within(canvasElement).getByRole('separator', { name: 'Console height' })
    await fireEvent.pointerDown(splitter, { clientX: 100, clientY: 100 })
    await fireEvent.pointerMove(window, { clientX: 100, clientY: 130 })
    await expect(args.onResize).toHaveBeenLastCalledWith(140)
    await fireEvent.pointerUp(window)
  },
}

// Both orientations in one frame — the visual-diff surface for the pip.
export const AllOrientations: Story = {
  parameters: { unframed: true },
  render: (args) => (
    <div className="flex items-center gap-region">
      {PANE_ORIENTATIONS.map((orientation) => (
        <span className="flex flex-col items-center gap-gap" key={orientation}>
          <span
            className={cn(
              'flex h-24 w-24 rounded-xl border border-inset-hair bg-inset',
              orientation === 'h' && 'flex-col',
            )}
          >
            <PaneSplitter {...args} orientation={orientation} label={`${orientation} splitter`} />
          </span>
          <Text variant="meta" className="text-foreground-faint">
            {orientation}
          </Text>
        </span>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('separator')).toHaveLength(
      PANE_ORIENTATIONS.length,
    )
  },
}
