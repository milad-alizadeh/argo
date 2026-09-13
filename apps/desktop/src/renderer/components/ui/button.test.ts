import { expect, test } from 'bun:test'

import { buttonVariants } from './button'

for (const variant of [
  'default',
  'destructive',
  'ghost',
  'link',
  'outline',
  'secondary',
] as const) {
  test(`${variant} buttons use a theme label color`, () => {
    expect(buttonVariants({ variant })).toMatch(/text-(primary-foreground|foreground)/)
  })
}
