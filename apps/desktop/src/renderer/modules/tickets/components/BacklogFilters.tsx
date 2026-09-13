import { ChevronDown } from 'lucide-react'

import { Button } from '../../../components/ui/button'

// The prototype's filters; the backlog reads open Tickets only until they are wired.
const FILTERS = ['State: Open', 'Label', 'Type'] as const

export function BacklogFilters() {
  return (
    <fieldset aria-label="Filters" className="flex flex-wrap gap-(--spacing-shell-tight)" disabled>
      {FILTERS.map((filter) => (
        <Button key={filter} size="xs" variant="outline">
          {filter}
          <ChevronDown aria-hidden="true" />
        </Button>
      ))}
    </fieldset>
  )
}
