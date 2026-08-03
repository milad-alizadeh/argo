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
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>
        <Text variant="row">Manage</Text>
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
  play: async ({ args }) => {
    const menu = within(document.body)
    await expect(
      await menu.findByText('Argo has no conflict editor. Resolve it where it is cheap:'),
    ).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Open a scratch terminal' })).toBeVisible()
    await userEvent.click(menu.getByRole('menuitem', { name: 'Resolve with an agent' }))
    await expect(args.onResolveWithAgent).toHaveBeenCalled()
  },
}
