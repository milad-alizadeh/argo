import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { MenuDropdownTrigger, SearchableDropdownTrigger } from './dropdown-trigger'
import { Icon } from './icon/icon'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTitle } from './ui/popover'

function TriggerStory({
  searchable,
  iconOnly,
  disabled = false,
}: {
  searchable: boolean
  iconOnly: boolean
  disabled?: boolean
}) {
  const trigger = {
    'aria-label': searchable ? 'Choose worktree' : 'Choose project',
    icon: searchable ? ('worktree' as const) : ('folder' as const),
    iconOnly,
    label: searchable ? 'New worktree' : 'Projects',
    disabled,
    appearance: 'menu' as const,
  }
  return (
    <div className="p-8">
      {searchable ? (
        <Popover>
          <SearchableDropdownTrigger {...trigger} />
          <PopoverContent className="w-(--size-session-menu) max-w-(--size-session-menu-max-width) gap-0 p-0">
            <PopoverTitle className="sr-only">Worktrees</PopoverTitle>
            <Command defaultValue="New worktree">
              <div className="mx-1">
                <CommandInput
                  appearance="inline"
                  aria-label="Search worktrees"
                  placeholder="Search worktrees"
                />
              </div>
              <CommandList className="max-h-56">
                <CommandGroup>
                  <CommandItem data-checked value="New worktree">
                    <Icon name="worktree" />
                    <span className="type-control">New worktree</span>
                  </CommandItem>
                  <CommandItem value="main">
                    <Icon name="worktree" />
                    <span className="type-control">main</span>
                  </CommandItem>
                </CommandGroup>
                <CommandGroup className="border-t border-border" heading="Existing worktrees">
                  {['linked-feature', 'design-system', 'session-search'].map((name) => (
                    <CommandItem key={name} value={name}>
                      <Icon name="worktree" />
                      <span className="min-w-0 truncate type-control">{name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <DropdownMenu>
          <MenuDropdownTrigger {...trigger} />
          <DropdownMenuContent className="max-w-[calc(100vw-2rem)]">
            <DropdownMenuItem>Argo</DropdownMenuItem>
            <DropdownMenuItem className="max-w-full truncate">
              A project name long enough to check popup bounds
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

const meta = {
  title: 'Components/Dropdown Trigger',
  component: TriggerStory,
} satisfies Meta<typeof TriggerStory>

export default meta
type Story = StoryObj<typeof TriggerStory>

export const LabelMenu: Story = {
  args: { searchable: false, iconOnly: false },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Choose project' })
    await expect(trigger).toHaveTextContent('Projects')
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(within(document.body).getByRole('menuitem', { name: 'Argo' })).toBeVisible(),
    )
  },
}

export const KeyboardMenuReturnsFocus: Story = {
  args: { searchable: false, iconOnly: false },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Choose project' })
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    await within(document.body).findByRole('menuitem', { name: 'Argo' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const DisabledMenu: Story = {
  args: { searchable: false, iconOnly: false, disabled: true },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Choose project' })
    await expect(trigger).toBeDisabled()
    await expect(within(document.body).queryByRole('menu')).toBeNull()
  },
}

export const NarrowMenuPopup: Story = {
  args: { searchable: false, iconOnly: false },
  decorators: [
    (Story) => (
      <div className="w-40">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Choose project' })
    await userEvent.click(trigger)
    const menu = await within(document.body).findByRole('menu')
    await waitFor(() => {
      const bounds = menu.getBoundingClientRect()
      expect(bounds.left).toBeGreaterThanOrEqual(0)
      expect(bounds.right).toBeLessThanOrEqual(window.innerWidth)
    })
  },
}

export const IconMenu: Story = {
  args: { searchable: false, iconOnly: true },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Choose project' })
    await expect(trigger).not.toHaveTextContent('Projects')
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(within(document.body).getByRole('menuitem', { name: 'Argo' })).toBeVisible(),
    )
  },
}

export const LabelSearch: Story = {
  args: { searchable: true, iconOnly: false },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Choose worktree' })
    await expect(trigger).toHaveTextContent('New worktree')
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(within(document.body).getByPlaceholderText('Search worktrees')).toBeVisible(),
    )
    const searchGroup = document.body.querySelector('[data-slot="input-group"]')
    const firstOption = document.body.querySelector('[data-slot="command-item"]')
    if (!searchGroup || !firstOption) throw new Error('Search popup rows did not render')
    const searchBounds = searchGroup.getBoundingClientRect()
    const optionBounds = firstOption.getBoundingClientRect()
    await expect(searchBounds.left).toBeCloseTo(optionBounds.left, 0)
    await expect(searchBounds.right).toBeCloseTo(optionBounds.right, 0)
  },
}

export const IconSearch: Story = {
  args: { searchable: true, iconOnly: true },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Choose worktree' })
    await expect(trigger).not.toHaveTextContent('New worktree')
    await userEvent.click(trigger)
    await waitFor(() =>
      expect(within(document.body).getByPlaceholderText('Search worktrees')).toBeVisible(),
    )
  },
}
