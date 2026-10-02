import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialog as RegistryAlertDialog,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Card as RegistryCard,
} from '../ui/card'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Dialog as RegistryDialog,
} from '../ui/dialog'
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Drawer as RegistryDrawer,
} from '../ui/drawer'
import {
  Sheet as RegistrySheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet'

const meta = {
  title: 'Design System/Primitives/Dialogs',
  parameters: { layout: 'centered' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function Overlay({ kind }: { kind: 'dialog' | 'alert' | 'sheet' | 'drawer' }) {
  const triggerName = `Open ${kind}`
  if (kind === 'dialog') {
    return (
      <RegistryDialog>
        <DialogTrigger render={<Button>{triggerName}</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registry dialog title</DialogTitle>
            <DialogDescription>Registry dialog description.</DialogDescription>
          </DialogHeader>
          <Button>Continue</Button>
        </DialogContent>
      </RegistryDialog>
    )
  }
  if (kind === 'alert') {
    return (
      <RegistryAlertDialog>
        <AlertDialogTrigger render={<Button>{triggerName}</Button>} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registry alert title</AlertDialogTitle>
            <AlertDialogDescription>Registry alert description.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </RegistryAlertDialog>
    )
  }
  if (kind === 'sheet') {
    return (
      <RegistrySheet>
        <SheetTrigger render={<Button>{triggerName}</Button>} />
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Registry sheet title</SheetTitle>
            <SheetDescription>Registry sheet description.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button>Continue</Button>
          </SheetFooter>
        </SheetContent>
      </RegistrySheet>
    )
  }
  return (
    <RegistryDrawer>
      <DrawerTrigger render={<Button>{triggerName}</Button>} />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Registry drawer title</DrawerTitle>
          <DrawerDescription>Registry drawer description.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Continue</Button>
          <DrawerClose render={<Button variant="outline" />}>Close drawer</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </RegistryDrawer>
  )
}

async function openEscapeAndReturn(
  canvasElement: HTMLElement,
  kind: string,
  role: 'dialog' | 'alertdialog' = 'dialog',
) {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: `Open ${kind}` })
  await userEvent.click(trigger)
  const dialog = await within(document.body).findByRole(role)
  await waitFor(() => expect(dialog).toBeVisible())
  const controls = within(dialog).getAllByRole('button')
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (!first || !last) throw new Error(`${kind} has no focusable controls.`)
  await userEvent.click(last)
  await userEvent.tab()
  await waitFor(() => expect(first).toHaveFocus())
  await userEvent.tab({ shift: true })
  await waitFor(() => expect(last).toHaveFocus())
  if (kind === 'sheet' || kind === 'drawer') {
    await userEvent.click(
      within(dialog).getByRole('button', { name: kind === 'sheet' ? 'Close' : 'Close drawer' }),
    )
  } else {
    await userEvent.keyboard('{Escape}')
  }
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
}

export const Dialog: Story = {
  render: () => <Overlay kind="dialog" />,
  play: ({ canvasElement }) => openEscapeAndReturn(canvasElement, 'dialog'),
}

export const AlertDialog: Story = {
  render: () => <Overlay kind="alert" />,
  play: ({ canvasElement }) => openEscapeAndReturn(canvasElement, 'alert', 'alertdialog'),
}

export const Card: Story = {
  render: () => (
    <RegistryCard className="w-80">
      <CardHeader>
        <CardTitle>Registry card title</CardTitle>
        <CardDescription>Registry card description.</CardDescription>
      </CardHeader>
      <CardContent>Registry card content.</CardContent>
    </RegistryCard>
  ),
  tags: ['view-only'],
}

export const Sheet: Story = {
  render: () => <Overlay kind="sheet" />,
  play: ({ canvasElement }) => openEscapeAndReturn(canvasElement, 'sheet'),
}

export const Drawer: Story = {
  render: () => <Overlay kind="drawer" />,
  play: ({ canvasElement }) => openEscapeAndReturn(canvasElement, 'drawer'),
}
