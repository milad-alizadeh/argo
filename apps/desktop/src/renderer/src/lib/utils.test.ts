import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('lets later Tailwind classes win conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('keeps a type role and a colour that sit on the same element', () => {
    expect(cn('text-meta', 'text-foreground-faint')).toBe('text-meta text-foreground-faint')
    expect(cn('text-row-strong', 'text-primary-foreground')).toBe(
      'text-row-strong text-primary-foreground',
    )
    expect(cn('text-code-inline', 'text-foreground-soft')).toBe(
      'text-code-inline text-foreground-soft',
    )
  })

  it('still lets a later type role replace an earlier one', () => {
    expect(cn('text-row', 'text-meta')).toBe('text-meta')
    expect(cn('text-tag', 'text-eyebrow')).toBe('text-eyebrow')
  })

  it('still lets a later colour replace an earlier one', () => {
    expect(cn('text-primary', 'text-status-working')).toBe('text-status-working')
  })
})
