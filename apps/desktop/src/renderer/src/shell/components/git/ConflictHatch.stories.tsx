import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Text,
} from '@/shared/components/ui'
import { ConflictHatch } from './ConflictHatch'

const meta = {
  title: 'Shell/GitControls/BranchManage/ConflictHatch',
  component: ConflictHatch,
  args: { onOpenScratchTerminal: fn(), onResolveWithAgent: fn() },
  render: (args) => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Text variant="row">Conflict</Text>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <ConflictHatch {...args} />
      </DropdownMenuContent>
    </DropdownMenu>
  ),
} satisfies Meta<typeof ConflictHatch>

export default meta
type Story = StoryObj<typeof meta>

/** The only thing a diverged branch is offered: it says the pull would conflict, says Argo has
 * no conflict editor, and hands the work out. Two exits, no merge UI. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    // Opened by a click rather than `defaultOpen`, and scoped to the NEWEST matching portal.
    // A menu Radix is animating closed keeps its wrapper on document.body after its children
    // go, so an earlier run's leftover reads as present, empty and invisible; portals append,
    // so the live one is last.
    await userEvent.click(within(canvasElement).getByText('Conflict'))
    const open = await within(document.body).findAllByRole('menu', { name: 'Conflict' })
    const menu = within(open[open.length - 1] ?? document.body)
    await expect(
      menu.getByText('Argo has no conflict editor. Resolve it where it is cheap:'),
    ).toBeInTheDocument()
    await expect(
      menu.getByRole('menuitem', { name: 'Open a scratch terminal' }),
    ).toBeInTheDocument()
    await userEvent.click(menu.getByRole('menuitem', { name: 'Resolve with an agent' }))
    await expect(args.onResolveWithAgent).toHaveBeenCalled()
  },
}
