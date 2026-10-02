import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '../ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '../ui/menubar'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '../ui/navigation-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

type SpecimenProps = { onAction: (action: string) => void }

function DropdownSpecimen({ onAction }: SpecimenProps) {
  const [sort, setSort] = useState('name')
  const [details, setDetails] = useState(true)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>File actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem disabled onClick={() => onAction('restore')}>
          Restore
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onAction('copy')}>Copy link</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuCheckboxItem checked={details} onCheckedChange={setDetails}>
          Show details
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onAction('delete')}>
          Delete file
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const meta = {
  title: 'Foundations/Primitives/Menu',
  component: DropdownSpecimen,
  args: { onAction: fn() },
} satisfies Meta<typeof DropdownSpecimen>

export default meta
type Story = StoryObj<typeof meta>
const page = () => within(document.body)

export const Dropdown: Story = {
  play: async ({ canvasElement, args }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'File actions' })
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(await page().findByRole('menuitem', { name: 'Restore' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    const share = page().getByRole('menuitem', { name: 'Share' })
    await expect(share).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(await page().findByRole('menuitem', { name: 'Copy link' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(share).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(args.onAction).not.toHaveBeenCalled()
    await userEvent.click(trigger)
    await userEvent.click(await page().findByRole('menuitem', { name: 'Delete file' }))
    await expect(args.onAction).toHaveBeenCalledWith('delete')
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    await expect(await page().findByRole('menuitemradio', { name: 'Name' })).toBeChecked()
    await userEvent.click(page().getByRole('menuitemradio', { name: 'Date' }))
    await expect(page().getByRole('menuitemradio', { name: 'Date' })).toBeChecked()
    await userEvent.click(page().getByRole('menuitemcheckbox', { name: 'Show details' }))
    await expect(page().getByRole('menuitemcheckbox', { name: 'Show details' })).not.toBeChecked()
  },
}

export const Context: Story = {
  render: ({ onAction }) => (
    <ContextMenu>
      <ContextMenuTrigger render={<Button variant="outline" />}>Readme.md</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled onClick={() => onAction('restore')}>
          Restore
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAction('open')}>Open file</ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={() => onAction('delete')}>
          Delete file
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
  play: async ({ canvasElement, args }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Readme.md' })
    await userEvent.tab()
    await userEvent.pointer({ target: trigger, keys: '[MouseRight]' })
    await expect(await page().findByRole('menuitem', { name: 'Restore' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    const open = page().getByRole('menuitem', { name: 'Open file' })
    for (let step = 0; step < 3 && document.activeElement !== open; step++)
      await userEvent.keyboard('{ArrowDown}')
    await expect(open).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(args.onAction).not.toHaveBeenCalled()
    await userEvent.pointer({ target: trigger, keys: '[MouseRight]' })
    await userEvent.click(await page().findByRole('menuitem', { name: 'Delete file' }))
    await expect(args.onAction).toHaveBeenCalledWith('delete')
  },
}

function SelectSpecimen() {
  const [value, setValue] = useState<string | null>('name')
  return (
    <Select
      value={value}
      onValueChange={setValue}
      items={{ name: 'Name', date: 'Date', size: 'Size' }}
    >
      <SelectTrigger aria-label="Sort files">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="name">Name</SelectItem>
        <SelectItem value="size" disabled>
          Size
        </SelectItem>
        <SelectItem value="date">Date</SelectItem>
      </SelectContent>
    </Select>
  )
}

export const Selection: Story = {
  render: () => <SelectSpecimen />,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('combobox', { name: 'Sort files' })
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    await expect(await page().findByRole('option', { name: 'Size' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.keyboard('{End}{Enter}')
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(trigger).toHaveTextContent('Date')
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{Escape}')
    await waitFor(() => expect(page().queryByRole('listbox')).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}

function MenubarSpecimen({ onAction }: SpecimenProps) {
  const [details, setDetails] = useState(true)
  return (
    <Menubar aria-label="File commands">
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem disabled>Paste</MenubarItem>
          <MenubarItem onClick={() => onAction('copy')}>Copy</MenubarItem>
          <MenubarItem variant="destructive" onClick={() => onAction('delete')}>
            Delete file
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarCheckboxItem checked={details} onCheckedChange={setDetails}>
            Show details
          </MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}

export const MenuBar: Story = {
  render: (args) => <MenubarSpecimen {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(await page().findByRole('menuitem', { name: 'Paste' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page().getByRole('menuitem', { name: 'Copy' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    const details = await page().findByRole('menuitemcheckbox', { name: 'Show details' })
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(details).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(canvas.getByRole('menuitem', { name: 'View' })).toHaveFocus()
    await expect(args.onAction).not.toHaveBeenCalled()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(page().getByRole('menuitemcheckbox', { name: 'Show details' })).toHaveFocus(),
    )
    await userEvent.keyboard('{Enter}')
    await expect(page().getByRole('menuitemcheckbox', { name: 'Show details' })).not.toBeChecked()
  },
}

export const Navigation: Story = {
  render: () => (
    <NavigationMenu aria-label="Documentation">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Guide</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="#overview">Overview</NavigationMenuLink>
            <NavigationMenuLink href="#shortcuts">Keyboard shortcuts</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger disabled>Archive</NavigationMenuTrigger>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#reference">Reference</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Guide' })
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: 'Archive' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await page().findByRole('link', { name: 'Overview' })
    await userEvent.tab()
    await waitFor(() => expect(page().getByRole('link', { name: 'Overview' })).toHaveFocus())
    await userEvent.tab()
    await waitFor(() =>
      expect(page().getByRole('link', { name: 'Keyboard shortcuts' })).toHaveFocus(),
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await waitFor(() => expect(page().getByRole('link', { name: 'Overview' })).toBeVisible())
  },
}
