import * as React from 'react'
import { StatusBadge } from '@/platform/renderer/components/design-system/status-badge'
import {
  filledToneRecipe,
  indicatorToneRecipe,
} from '@/platform/renderer/components/design-system/tone-recipes'
import { Badge } from '@/platform/renderer/components/ui/badge'

export const NATIVE_BADGE_VARIANTS = [
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
] as const

export function NativeBadges() {
  const [count, setCount] = React.useState(0)
  return (
    <div className="grid justify-items-start gap-4">
      <div className="flex flex-wrap gap-2">
        {NATIVE_BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </div>
      <Badge render={<a href="#badge-destination" />} variant="secondary">
        Badge destination
      </Badge>
      <Badge
        onClick={() => setCount((value) => value + 1)}
        render={<button type="button" />}
        variant="destructive"
      >
        Remove badge
      </Badge>
      <Badge render={<button disabled type="button" />} variant="secondary">
        Disabled badge
      </Badge>
      <Badge render={<a href="#badge-destination" />} variant="destructive">
        Destructive destination
      </Badge>
      <output aria-label="Removal count">{count}</output>
      <span id="badge-destination">Destination</span>
    </div>
  )
}

export function AppToneTreatments() {
  return (
    <div className="grid justify-items-start gap-4">
      <StatusBadge data-treatment="subtle" ref={React.createRef()} title="Attention" tone="warning">
        Needs input
      </StatusBadge>
      <div className="flex gap-2">
        {Object.entries(filledToneRecipe).map(([tone, recipe]) => (
          <span
            className={`rounded-full px-2 text-xs font-medium ${recipe}`}
            data-treatment="filled"
            key={tone}
          >
            {tone}
          </span>
        ))}
      </div>
      <ul className="grid gap-2">
        {Object.entries(indicatorToneRecipe).map(([tone, recipe]) => (
          <li className="flex items-center gap-2" key={tone}>
            <span
              aria-hidden="true"
              className={`size-2 rounded-full bg-current ${recipe}`}
              data-treatment="indicator"
              data-tone={tone}
            />
            {tone}
          </li>
        ))}
      </ul>
    </div>
  )
}
