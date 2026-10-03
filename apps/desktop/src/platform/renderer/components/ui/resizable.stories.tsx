import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable'

const meta = {
  title: 'Design System/Primitives/Resizable',
  component: ResizablePanelGroup,
  decorators: [
    (Story) => (
      <div className="h-48 w-[600px]">
        <Story />
      </div>
    ),
  ],
  args: {
    orientation: 'horizontal',
    children: (
      <>
        <ResizablePanel id="first-pane" defaultSize={300} minSize={100}>
          <div className="flex h-full items-center justify-center">First pane</div>
        </ResizablePanel>
        <ResizableHandle aria-label="Resize panes" />
        <ResizablePanel id="second-pane" minSize={100}>
          <div className="flex h-full items-center justify-center">Second pane</div>
        </ResizablePanel>
      </>
    ),
  },
} satisfies Meta<typeof ResizablePanelGroup>

export default meta
type Story = StoryObj<typeof meta>

export const KeyboardResize: Story = {
  play: async ({ canvasElement }) => {
    const separator = within(canvasElement).getByRole('separator', { name: 'Resize panes' })
    const initialValue = separator.getAttribute('aria-valuenow')
    separator.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(separator).toHaveFocus()
    await expect(separator).toHaveAttribute('aria-orientation', 'vertical')
    await expect(separator.getAttribute('aria-valuenow')).not.toBe(initialValue)
  },
}
