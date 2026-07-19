import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The stock text-* size scale is removed from the theme (globals.css) in favour of the
// type-role ladder, so tailwind-merge would file every `text-<role>` under text-colour
// and drop the colour class sitting beside it. Teaching it the roles keeps
// `text-meta text-foreground-faint` intact while still de-duping role against role.
const TYPE_ROLES = [
  'headline',
  'title',
  'row',
  'row-strong',
  'prose',
  'meta',
  'tag',
  'eyebrow',
  'code',
  'code-inline',
]

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: TYPE_ROLES }] } },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
