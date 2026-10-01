import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import * as React from 'react'
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
