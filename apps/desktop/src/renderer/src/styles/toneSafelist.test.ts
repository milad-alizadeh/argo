import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { RAIL_TONES } from '@/ship'

// The `text-tone-${tone}` classes are built at runtime, so Tailwind never sees them as
// literals — the `@source inline(...)` safelist in globals.css is the only thing that
// emits them. Interpolating instead of mapping dropped the map's compile-time
// exhaustiveness check, so a tone added to RAIL_TONES without a matching safelist entry
// would ship with no colour and no error. This test is that missing check.
it('safelists a text-tone utility for every RailTone', () => {
  const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8')
  const match = css.match(/@source inline\("text-tone-\{([^}]+)\}"\)/)
  expect(match, 'globals.css must declare @source inline("text-tone-{...}")').not.toBeNull()

  const safelisted = (match?.[1] ?? '').split(',').map((tone) => tone.trim())
  expect([...safelisted].sort()).toEqual([...RAIL_TONES].sort())
})
