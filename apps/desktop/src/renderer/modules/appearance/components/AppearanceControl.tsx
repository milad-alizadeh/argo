// System, Light and Dark (#1820). The control shows the choice, not the resolution, so System
// stays selected while the operating system moves the window between the other two.

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { APPEARANCES, type Appearance, isAppearance } from '@/core/appearance/appearance'
import { ToggleGroup, ToggleGroupItem } from '../../../components/ui/toggle-group'

const LABELS: Record<Appearance, string> = { system: 'System', light: 'Light', dark: 'Dark' }

const OPTION =
  'h-6 rounded-[calc(var(--radius-md)-2px)] px-2.5 text-control text-muted-foreground hover:bg-transparent aria-pressed:bg-card aria-pressed:text-foreground'

const COMPACT_OPTION =
  'size-(--size-navigation-control) rounded-(--radius-md) text-muted-foreground hover:bg-muted aria-pressed:bg-card aria-pressed:text-foreground'

const APPEARANCE_ICONS = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} as const

export function AppearanceControl({
  appearance,
  onChange,
  compact = false,
}: {
  appearance: Appearance
  onChange: (chosen: Appearance) => void
  compact?: boolean
}) {
  return (
    <ToggleGroup
      data-component="AppearanceControl"
      aria-label="Appearance"
      orientation={compact ? 'vertical' : 'horizontal'}
      spacing={0.5}
      value={[appearance]}
      onValueChange={(chosen) => {
        // Pressing the pressed option empties the group. The appearance keeps its value instead,
        // because there is no fourth state to fall back to.
        const [next] = chosen
        if (isAppearance(next)) onChange(next)
      }}
      className={compact ? 'bg-transparent' : 'rounded-md bg-muted p-0.5'}
    >
      {APPEARANCES.map((option) => {
        const Icon = APPEARANCE_ICONS[option]
        return (
          <ToggleGroupItem
            aria-label={`Use ${LABELS[option]} appearance`}
            key={option}
            value={option}
            className={compact ? COMPACT_OPTION : OPTION}
          >
            {compact ? <Icon aria-hidden="true" /> : LABELS[option]}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
