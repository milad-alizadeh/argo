import { useEffect, useRef, useState } from 'react'
import { Button, Text } from '@/shared/components/ui'

/**
 * Molecule: the name a branch operation needs before it can run.
 *
 * `New branch` and `Rename` both take exactly one name, and a menu row that fires without one is
 * an operation that can only fail — so the row opens this instead of dispatching. An empty name
 * cannot be submitted: that is a guard at the boundary, not a state worth rendering.
 */
export function BranchNameField({
  title,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  /** What the field is for, e.g. `New branch`. */
  title: string
  submitLabel: string
  onSubmit: (name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const trimmed = name.trim()
  // A field the menu just opened has to take the caret, or the row you clicked leaves you
  // typing into the menu's item search. Done with a ref rather than `autoFocus`, which
  // biome's a11y rule bans outright.
  useEffect(() => field.current?.focus(), [])
  return (
    <form
      className="flex flex-col gap-gap p-inset"
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed !== '') onSubmit(trimmed)
      }}
    >
      <Text variant="eyebrow" as="div" className="text-foreground-faint">
        {title}
      </Text>
      <input
        ref={field}
        // Radix's menus run a typeahead over keystrokes; without this the field would lose its
        // own letters to the menu's item search.
        onKeyDown={(event) => event.stopPropagation()}
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label={title}
        className="w-full rounded-md bg-inset px-gap py-tight text-row text-foreground inset-lip focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex justify-end gap-tight">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={trimmed === ''}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
