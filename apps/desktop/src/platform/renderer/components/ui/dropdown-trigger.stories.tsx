import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Icon } from '../icon/icon'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from './dropdown-menu'
import { MenuDropdownTrigger, SearchableDropdownTrigger } from './dropdown-trigger'
import { Popover, PopoverContent, PopoverTitle } from './popover'

function TriggerStory({ searchable, iconOnly }: { searchable: boolean; iconOnly: boolean }) {
  const trigger = {
    'aria-label': searchable ? 'Choose worktree' : 'Choose project',
    icon: searchable ? ('worktree' as const) : ('folder' as const),
    iconOnly,
    label: searchable ? 'New worktree' : 'Projects',
    variant: 'ghost' as const,
  }
  return (
    <div className="p-8">
      {searchable ? (
        <Popover>
          <SearchableDropdownTrigger {...trigger} />
          <PopoverContent className="w-(--size-session-menu) max-w-(--size-session-menu-max-width) gap-0 p-0">
            <PopoverTitle className="sr-only">Worktrees</PopoverTitle>
            <Command defaultValue="New worktree">
              <CommandInput
                appearance="inline"
                aria-label="Search worktrees"
                placeholder="Search worktrees"
              />
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
          <DropdownMenuContent>
            <DropdownMenuItem>Argo</DropdownMenuItem>
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
