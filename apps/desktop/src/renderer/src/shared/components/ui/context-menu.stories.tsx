import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './context-menu'
import { Text } from './Text'

const meta = {
  title: 'Shared/ContextMenu',
  component: ContextMenuContent,
} satisfies Meta<typeof ContextMenuContent>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The right-click menu, opened on its trigger.
 *
 * It wears the same plane and row treatment as the dropdown menu, because a menu is a menu
 * however it was summoned; only the gesture that opens it differs.
 */
export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger>
        <Text variant="row">Right-click this</Text>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>
          <Text variant="row">Project settings</Text>
        </ContextMenuItem>
        <ContextMenuItem disabled>
          <Text variant="row">Remove project</Text>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.pointer({ keys: '[MouseRight]', target: canvas.getByText('Right-click this') })
    // The menu portals in and fills its rows over two frames, so the row is asserted through a
    // retry: a `findBy*` settles as soon as the element exists, which is one frame too early.
    await waitFor(() => expect(within(document.body).getByText('Project settings')).toBeVisible())
  },
}
