import { ToggleGroup, ToggleGroupItem } from '@/components/ui'

export const CHANGES_VIEWS = ['all', 'commits'] as const

/** Which shape the Changes tab renders its files in. */
export type ChangesView = (typeof CHANGES_VIEWS)[number]

function isChangesView(value: string): value is ChangesView {
  return (CHANGES_VIEWS as readonly string[]).includes(value)
}

/**
 * Molecule: the All files | By commit segmented toggle inside the WorkTabs strip, Changes
 * tab only. Vendored `ToggleGroup` on Radix, `type="single"` — always exactly one selected,
 * so a click on the already-selected side is ignored rather than clearing it.
 */
export function ChangesViewToggle({
  view,
  onChangeView,
}: {
  /** The view currently selected. */
  view: ChangesView
  /** Select a view. */
  onChangeView: (view: ChangesView) => void
}): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(value) => {
        if (isChangesView(value)) onChangeView(value)
      }}
      aria-label="Changes view"
    >
      <ToggleGroupItem value="all">All files</ToggleGroupItem>
      <ToggleGroupItem value="commits">By commit</ToggleGroupItem>
    </ToggleGroup>
  )
}
