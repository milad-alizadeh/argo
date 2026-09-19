import { Expand, Minimize2, PanelRight } from 'lucide-react'

import { Button } from '@/platform/renderer/components/ui/button'

type InspectorState = 'open' | 'collapsed' | 'expanded'

export function InspectorToggles({
  noun,
  state,
  onToggle,
  onToggleExpanded,
}: {
  noun: string
  state: InspectorState
  onToggle: () => void
  onToggleExpanded: () => void
}) {
  const expanded = state === 'expanded'
  return (
    // It floats over a drag-region header, so it must opt out or the window swallows its clicks.
    <div className="no-drag-region absolute top-0 right-(--spacing-shell-gutter) z-20 flex h-(--size-chrome-bar) items-center gap-(--spacing-shell-tight)">
      {state === 'collapsed' ? (
        <Button
          aria-label={`Open ${noun} inspector`}
          variant="secondary"
          size="icon-sm"
          onClick={onToggle}
        >
          <PanelRight />
        </Button>
      ) : (
        <>
          <Button
            aria-label={expanded ? `Restore ${noun} sidebar` : `Expand ${noun} sidebar`}
            variant="ghost"
            size="icon-sm"
            onClick={onToggleExpanded}
          >
            {expanded ? <Minimize2 /> : <Expand />}
          </Button>
          <Button
            aria-label={`Collapse ${noun} inspector`}
            variant="secondary"
            size="icon-sm"
            onClick={onToggle}
          >
            <PanelRight />
          </Button>
        </>
      )}
    </div>
  )
}
