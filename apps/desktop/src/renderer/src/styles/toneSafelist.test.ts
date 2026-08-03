import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { DOT_GLOWS, ROSTER_TONES } from '@/shared/status'

// The `text-tone-${tone}` and `glow-${weight}` classes are built at runtime, so Tailwind
// never sees them as literals — the `@source inline(...)` safelist in globals.css is the
// only thing that emits them. Interpolating instead of mapping dropped the map's
// compile-time exhaustiveness check, so a value added to either union without a matching
// safelist entry would ship unstyled and with no error. These tests are that missing check.

const safelistedIn = (utility: string): string[] => {
  const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')
  const match = css.match(new RegExp(`@source inline\\("${utility}-\\{([^}]+)\\}"\\)`))
  expect(match, `globals.css must declare @source inline("${utility}-{...}")`).not.toBeNull()
  return (match?.[1] ?? '').split(',').map((value) => value.trim())
}

it('safelists a text-tone utility for every RosterTone', () => {
  expect(safelistedIn('text-tone').sort()).toEqual([...ROSTER_TONES].sort())
})

it('safelists a glow utility for every DotGlow weight', () => {
  expect(safelistedIn('glow').sort()).toEqual([...DOT_GLOWS].sort())
})
