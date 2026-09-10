// System, Light and Dark (#1820). The control shows the choice, not the resolution, so System
// stays selected while the operating system moves the window between the other two.
import { APPEARANCES, type Appearance, isAppearance } from '../../appearance/appearance'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

const LABELS: Record<Appearance, string> = { system: 'System', light: 'Light', dark: 'Dark' }

const OPTION =
  'h-6 rounded-[calc(var(--radius-md)-2px)] px-2.5 text-control text-muted-foreground hover:bg-transparent aria-pressed:bg-card aria-pressed:text-foreground'

export function AppearanceControl({
  appearance,
  onChange,
}: {
  appearance: Appearance
  onChange: (chosen: Appearance) => void
}) {
  return (
    <ToggleGroup
      data-component="AppearanceControl"
      aria-label="Appearance"
      spacing={0.5}
      value={[appearance]}
      onValueChange={(chosen) => {
        // Pressing the pressed option empties the group. The appearance keeps its value instead,
        // because there is no fourth state to fall back to.
        const [next] = chosen
        if (isAppearance(next)) onChange(next)
      }}
      className="rounded-md bg-muted p-0.5"
    >
      {APPEARANCES.map((option) => (
        <ToggleGroupItem key={option} value={option} className={OPTION}>
          {LABELS[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
