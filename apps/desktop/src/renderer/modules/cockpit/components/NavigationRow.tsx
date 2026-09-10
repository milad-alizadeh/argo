// Selection is the ground alone: no leading accent rule (#1896). The glyph is a mark, not a
// control, so it carries no name of its own and the row's label names the row (#1784).
import { Button } from '../../../components/ui/button'

const ROW =
  'w-full justify-start gap-2 rounded-md px-2 text-body text-muted-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground'

export function NavigationRow({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Button
      data-component="NavigationRow"
      variant="ghost"
      aria-current={selected ? 'page' : undefined}
      onClick={onSelect}
      className={ROW}
    >
      <span aria-hidden="true" className="size-4 rounded-xs bg-current opacity-55" />
      {label}
    </Button>
  )
}
