import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The closed type-role ladder — the ONE list of role names. It lives in lib because `cn`
// needs it (below) and components may import lib, never the reverse; Text.tsx binds each
// name to its `text-<role>` class.
export const TYPE_ROLES = [
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
] as const

export type TypeRole = (typeof TYPE_ROLES)[number]

// The stock text-* size scale is removed from the theme (globals.css), so without this
// tailwind-merge files every `text-<role>` under text-colour and drops the colour class
// sitting beside it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: [...TYPE_ROLES] }] } },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
