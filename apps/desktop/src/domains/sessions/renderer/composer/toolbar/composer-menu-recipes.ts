import { cn } from '@/platform/renderer/lib/utils'

export function composerMenuTriggerRecipe(className?: string) {
  return cn('shrink-0 text-foreground', className)
}

export function composerMenuPopupRecipe(className?: string) {
  return cn('w-(--size-session-menu)', className)
}

export const composerRichOptionRecipe = {
  row: 'items-start rounded-md py-1.5 pr-8 pl-2',
  icon: 'mt-0.5 size-3.5',
  content: 'grid min-w-0 gap-0.5',
  label: 'type-heading',
  detail: 'type-meta',
} as const
