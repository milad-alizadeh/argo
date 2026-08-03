import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Text } from './Text'

const meta = {
  title: 'Shared/DropdownMenu',
  component: DropdownMenuContent,
} satisfies Meta<typeof DropdownMenuContent>

export default meta
type Story = StoryObj<typeof meta>

/** Every row shape the cockpit's menus use: a labelled group, an actionable row, a row the
 * menu refuses with its reason stated beside it, and a destructive row. */
export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Text variant="row">Branch</Text>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Text variant="eyebrow">Sync with origin</Text>
          </DropdownMenuLabel>
          <DropdownMenuItem>
            <Text variant="row">Fetch</Text>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Text variant="row">Pull</Text>
            <Text variant="meta" className="ml-auto text-foreground-faint">
              up to date
            </Text>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Text variant="row">Delete</Text>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    // Opened by a click, then scoped to the menu that click created. Querying document.body for a
    // `defaultOpen` menu finds sibling stories' portals, including torn-down ones.
    await userEvent.click(within(canvasElement).getByText('Branch'))
    const menu = within(await within(document.body).findByRole('menu', { name: 'Branch' }))
    await expect(menu.getByText('Fetch')).toBeInTheDocument()
    await expect(menu.getByRole('menuitem', { name: 'Pull up to date' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
}
