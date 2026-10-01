import { expect, test } from 'bun:test'

import { cn } from './utils'

test('keeps complete app recipes and colors in either order', () => {
  expect(cn('bg-primary text-primary-foreground', 'px-3 type-body')).toBe(
    'bg-primary text-primary-foreground px-3 type-body',
  )
  expect(cn('type-body', 'text-muted-foreground')).toBe('type-body text-muted-foreground')
  expect(cn('type-title', 'text-foreground')).toBe('type-title text-foreground')
  expect(cn('type-control', 'text-primary-foreground')).toBe('type-control text-primary-foreground')
  expect(cn('type-meta', 'text-faint')).toBe('type-meta text-faint')
})

test('a complete app recipe replaces all inherited metric classes together', () => {
  expect(cn('text-sm leading-7 font-medium tracking-wide text-foreground', 'type-control')).toBe(
    'text-foreground type-control',
  )
  expect(cn('type-body', 'type-meta')).toBe('type-meta')
  expect(cn('type-meta', 'type-body')).toBe('type-body')
  expect(cn('md:text-sm md:leading-7 md:font-medium md:tracking-wide', 'md:type-code')).toBe(
    'md:type-code',
  )
  expect(cn('hover:type-body', 'hover:type-control')).toBe('hover:type-control')
  expect(cn('type-body', 'md:type-meta')).toBe('type-body md:type-meta')
})
