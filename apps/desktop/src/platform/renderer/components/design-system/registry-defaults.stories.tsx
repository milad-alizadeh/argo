import type { Meta, StoryObj } from '@storybook/react-vite'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import * as React from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { Input } from '@/platform/renderer/components/ui/input'

export const longControlLabel = 'Save the complete configuration for the selected project'
export const longInputValue =
  '/workspace/projects/an-example-with-a-long-directory-name/settings.json'

export function ButtonSpecimen() {
  const [saved, setSaved] = React.useState(0)
  return (
    <div className="flex max-w-full flex-wrap items-center gap-4">
      <Button onClick={() => setSaved(saved + 1)}>Save</Button>
      <output aria-label="Saved count">{saved}</output>
      <Button disabled>Unavailable</Button>
      <Button aria-invalid variant="outline">
        Invalid action
      </Button>
      <Button aria-label="Search" size="icon-xs">
        <MagnifyingGlassIcon />
      </Button>
      <Button size="sm">
        <Icon name="search" size="primitive" />
        Small
      </Button>
      <Button size="xs">
        <Icon name="search" size="primitive" />
        Extra small
      </Button>
      <Button>
        <Icon name="search" />
        App icon
      </Button>
      <Button size="lg">
        <Icon name="search" size="primitive" />
        Large
      </Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link action</Button>
      <Button variant="outline">
        <span className="max-w-52 truncate">{longControlLabel}</span>
      </Button>
    </div>
  )
}

export function InputSpecimen() {
  const identifier = React.useId()
  const [value, setValue] = React.useState('')
  return (
    <div className="grid w-full max-w-80 gap-3">
      <label htmlFor={identifier}>Project name</label>
      <Input id={identifier} onChange={(event) => setValue(event.target.value)} value={value} />
      <output aria-label="Entered name">{value || 'Empty'}</output>
      <Input aria-label="Unavailable input" defaultValue="Unavailable" disabled />
      <Input
        aria-describedby={`${identifier}-error`}
        aria-invalid
        aria-label="Invalid input"
        defaultValue="Invalid"
      />
      <p id={`${identifier}-error`}>A project name is required.</p>
      <Input aria-label="Long path" defaultValue={longInputValue} />
    </div>
  )
}

async function playButtons({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement)
  const save = canvas.getByRole('button', { name: 'Save' })
  save.focus()
  await expect(save).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  await expect(canvas.getByLabelText('Saved count')).toHaveTextContent('1')
  await userEvent.keyboard(' ')
  await expect(canvas.getByLabelText('Saved count')).toHaveTextContent('2')
  await userEvent.tab()
  await expect(canvas.getByRole('button', { name: 'Invalid action' })).toHaveFocus()
  await expect(canvas.getByRole('button', { name: 'Unavailable' })).toBeDisabled()
  await expect(canvas.getByRole('button', { name: 'Invalid action' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(canvas.getByRole('button', { name: 'Search' })).toHaveAccessibleName('Search')
  await expect(canvas.getByRole('button', { name: longControlLabel })).toBeVisible()
}

async function playInputs({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement)
  const input = canvas.getByRole('textbox', { name: 'Project name' })
  await userEvent.click(input)
  await userEvent.type(input, 'Argo')
  await expect(canvas.getByLabelText('Entered name')).toHaveTextContent('Argo')
  await userEvent.tab()
  await expect(canvas.getByRole('textbox', { name: 'Invalid input' })).toHaveFocus()
  await expect(canvas.getByRole('textbox', { name: 'Invalid input' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(canvas.getByRole('textbox', { name: 'Unavailable input' })).toBeDisabled()
  await expect(canvas.getByRole('textbox', { name: 'Long path' })).toHaveValue(longInputValue)
}

const meta = {
  title: 'Components/StylingFoundation/RegistryDefaults',
  excludeStories: ['longControlLabel', 'longInputValue', 'ButtonSpecimen', 'InputSpecimen'],
  parameters: { layout: 'padded' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Buttons: Story = {
  render: () => <ButtonSpecimen />,
  play: playButtons,
}
export const Inputs: Story = {
  render: () => <InputSpecimen />,
  play: playInputs,
}
