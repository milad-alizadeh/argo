import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { cn } from '@/platform/renderer/lib/utils'
import { metrics, mountSpecimen } from './browser-fixture'

let cleanup = () => {}
afterEach(() => cleanup())

describe.each(['light', 'dark'])('%s typography', (appearance) => {
  test('Tailwind keeps normal text and spacing scales', async () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <div>
        <p className="text-xs">Extra small text</p>
        <p className="text-sm">Small text</p>
        <p className="text-base">Base text</p>
        <section className="size-8 p-2" aria-label="Spacing specimen" />
      </div>,
    )
    cleanup = mounted.cleanup
    const sizes = [
      ['Extra small text', '12px', '16px'],
      ['Small text', '14px', '20px'],
      ['Base text', '16px', '24px'],
    ] as const
    for (const [label, size, lineHeight] of sizes) {
      expect(metrics(page.getByText(label, { exact: true }).element())).toMatchObject({
        size,
        lineHeight,
      })
    }
    const space = getComputedStyle(page.getByLabelText('Spacing specimen').element())
    expect(space.width).toBe('32px')
    expect(space.padding).toBe('8px')
  })

  test('a merged complete recipe replaces all four primitive metrics', () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const className = cn(
      'text-base leading-7 font-semibold tracking-wide text-foreground',
      'type-control',
    )
    const mounted = mountSpecimen(<p className={className}>App control text</p>)
    cleanup = mounted.cleanup
    expect(className).toBe('text-foreground type-control')
    expect(metrics(page.getByText('App control text').element())).toEqual({
      size: '14px',
      lineHeight: '20px',
      weight: '400',
      tracking: 'normal',
    })
  })

  test('recipes replace one another and preserve intentional inheritance', () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <div className={cn('type-title', 'type-meta')}>
        <span>Inherited metadata</span>
        <span className="type-code">Code text</span>
      </div>,
    )
    cleanup = mounted.cleanup
    expect(metrics(page.getByText('Inherited metadata').element())).toEqual({
      size: '12px',
      lineHeight: '16px',
      weight: '400',
      tracking: 'normal',
    })
    expect(metrics(page.getByText('Code text').element())).toEqual({
      size: '13px',
      lineHeight: '19px',
      weight: '400',
      tracking: 'normal',
    })
  })
})
