import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  AlertDialog as RegistryAlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/platform/renderer/components/ui/alert-dialog'
import {
  Card as RegistryCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/platform/renderer/components/ui/card'
import {
  Dialog as RegistryDialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/platform/renderer/components/ui/dialog'
import {
  Drawer as RegistryDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/platform/renderer/components/ui/drawer'
import {
  Sheet as RegistrySheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/platform/renderer/components/ui/sheet'

const meta = {
  title: 'Components/Dialogs',
  parameters: { layout: 'centered' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function expectTitleMetrics(
  title: Element,
  canvasElement: HTMLElement,
  className = 'text-base font-medium',
) {
  const reference = document.createElement('span')
  reference.className = className
  reference.textContent = 'Reference title'
  canvasElement.append(reference)
  const titleStyle = getComputedStyle(title)
  const referenceStyle = getComputedStyle(reference)
  for (const property of [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
  ] as const) {
    expect(titleStyle[property]).toBe(referenceStyle[property])
  }
  reference.remove()
}

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
  const titleSlot = kind === 'alert' ? 'alert-dialog-title' : `${kind}-title`
  const title = dialog.querySelector(`[data-slot="${titleSlot}"]`)
  if (title && kind !== 'dialog') expectTitleMetrics(title, canvasElement)
  if (kind !== 'drawer') {
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))
  }
  await userEvent.keyboard('{Escape}')
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const title = canvas.getByText('Registry card title')
    await expect(title).toBeVisible()
    expectTitleMetrics(title, canvasElement, 'text-base leading-snug font-medium')
    await expect(canvas.getByText('Registry card description.')).toBeVisible()
    await expect(canvas.getByText('Registry card content.')).toBeVisible()
  },
}

export const Sheet: Story = {
  render: () => <Overlay kind="sheet" />,
  play: ({ canvasElement }) => openEscapeAndReturn(canvasElement, 'sheet'),
}

export const Drawer: Story = {
  render: () => <Overlay kind="drawer" />,
  play: ({ canvasElement }) => openEscapeAndReturn(canvasElement, 'drawer'),
}
