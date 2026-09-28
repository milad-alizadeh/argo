import type { IconWeight } from '@phosphor-icons/react'
import { cn } from 'cn'
import type * as React from 'react'
import { ICONS, type IconName } from './icon-registry'

export type { IconName } from './icon-registry'

export type IconSize = 'control' | 'meta' | 'inline' | 'text'

const SIZE_CLASS: Record<IconSize, string> = {
  control: 'size-(--size-icon-control)',
  meta: 'size-(--size-icon-meta)',
  inline: 'size-(--size-icon-inline)',
  text: 'size-(--size-icon-text)',
}

type IconAccessibility =
  | { 'aria-label': string; 'aria-hidden'?: never }
  | { 'aria-label'?: never; 'aria-hidden'?: true }

export type IconProps = Omit<
  React.ComponentPropsWithoutRef<'svg'>,
  'aria-hidden' | 'aria-label' | 'children'
> &
  IconAccessibility & {
    name: IconName
    size?: IconSize
    weight?: IconWeight
  }

// Shared icon styles keep every role consistent across buttons, headers, and metadata.
export function Icon({ className, name, size, weight = 'regular', ...props }: IconProps) {
  const Glyph = ICONS[name]
  return (
    <Glyph
      aria-hidden={props['aria-label'] === undefined ? true : undefined}
      className={cn(size && SIZE_CLASS[size], className)}
      data-slot="icon"
      data-icon={name}
      {...props}
      weight={weight}
      mirrored={name === 'panel-right'}
    />
  )
}
