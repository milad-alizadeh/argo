import { describe, expect, test } from 'bun:test'
import { buttonTextClasses } from './Button'

describe('Button', () => {
  test('uses approved foreground tokens for every variant', () => {
    for (const className of Object.values(buttonTextClasses)) {
      expect(className).toMatch(/text-(primary-foreground|foreground)/)
    }
  })
})
