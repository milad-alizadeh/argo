import { expect, test } from 'bun:test'

import { cn } from '@/platform/renderer/lib/utils'

test('keeps custom text sizes and colors in either order', () => {
  expect(cn('bg-primary text-primary-foreground', 'px-3 text-body')).toBe(
    'bg-primary text-primary-foreground px-3 text-body',
  )
  expect(cn('text-body', 'text-muted-foreground')).toBe('text-body text-muted-foreground')
  expect(cn('text-title', 'text-foreground')).toBe('text-title text-foreground')
  expect(cn('text-control', 'text-primary-foreground')).toBe('text-control text-primary-foreground')
  expect(cn('text-meta', 'text-faint')).toBe('text-meta text-faint')
})
