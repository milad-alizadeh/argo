import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export type IconProps = Pick<
  ComponentProps<'svg'>,
  'width' | 'height' | 'className' | 'aria-hidden' | 'aria-label' | 'role'
> & {
  // Light is the cockpit's only icon weight, so this can restate the pin but never
  // change it. Kept until `roster/SessionRow.tsx` (owned by #3) drops the prop.
  weight?: 'light'
}

export type IconAtom = (props: IconProps) => React.JSX.Element

// The one place the cockpit's icon voice is pinned: Phosphor Light, in the shared
// `icon` box. Weight and fill never encode state — the enclosing element's
// currentColor does — so no icon file gets a say in either.
export function createIcon(Glyph: PhosphorIcon): IconAtom {
  function Icon({ className, ...rest }: IconProps): React.JSX.Element {
    return <Glyph {...rest} className={cn('icon', className)} weight="light" />
  }
  Icon.displayName = Glyph.displayName
  return Icon
}
