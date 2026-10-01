import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import * as React from 'react'
import { controlRecipes } from '@/platform/renderer/components/design-system/control-recipes'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { Input } from '@/platform/renderer/components/ui/input'

export const longControlLabel = 'Save the complete configuration for the selected project'
export const longInputValue =
  '/workspace/projects/an-example-with-a-long-directory-name/settings.json'

export function ButtonSpecimen({ adapted = false }: { adapted?: boolean }) {
  const [saved, setSaved] = React.useState(0)
  const className = adapted ? controlRecipes.button : undefined
  return (
    <div className="flex max-w-full flex-wrap items-center gap-4">
      <Button className={className} onClick={() => setSaved(saved + 1)}>
        Save
      </Button>
      <output aria-label="Saved count">{saved}</output>
      <Button className={className} disabled>
        Unavailable
      </Button>
      <Button aria-invalid className={className} variant="outline">
        Invalid action
      </Button>
      <Button aria-label="Search" className={className} size="icon-xs">
        <MagnifyingGlassIcon />
      </Button>
      <Button className={className} size="sm">
        <Icon name="search" size="primitive" />
        Small
      </Button>
      <Button className={className} size="xs">
        <Icon name="search" size="primitive" />
        Extra small
      </Button>
      <Button className={className}>
        <Icon name="search" />
        App icon
      </Button>
      <Button className={className} size="lg">
        <Icon name="search" size="primitive" />
        Large
      </Button>
      <Button className={className} variant="secondary">
        Secondary
      </Button>
      <Button className={className} variant="ghost">
        Ghost
      </Button>
      <Button className={className} variant="destructive">
        Destructive
      </Button>
      <Button className={className} variant="link">
        Link action
      </Button>
      <Button className={className} variant="outline">
        <span className="max-w-52 truncate">{longControlLabel}</span>
      </Button>
    </div>
  )
}

export function InputSpecimen({ adapted = false }: { adapted?: boolean }) {
  const identifier = React.useId()
  const [value, setValue] = React.useState('')
  const className = adapted ? controlRecipes.codeInput : undefined
  return (
    <div className="grid w-full max-w-80 gap-3">
      <label htmlFor={identifier}>Project name</label>
      <Input
        className={className}
        id={identifier}
        onChange={(event) => setValue(event.target.value)}
        value={value}
      />
      <output aria-label="Entered name">{value || 'Empty'}</output>
      <Input
        aria-label="Unavailable input"
        className={className}
        defaultValue="Unavailable"
        disabled
      />
      <Input
        aria-describedby={`${identifier}-error`}
        aria-invalid
        aria-label="Invalid input"
        className={className}
        defaultValue="Invalid"
      />
      <p id={`${identifier}-error`}>A project name is required.</p>
      <Input aria-label="Long path" className={className} defaultValue={longInputValue} />
    </div>
  )
}
