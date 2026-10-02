import { expect, test } from 'bun:test'
import type { VirtualItem, Virtualizer } from '@tanstack/virtual-core'
import { rowAboveReader } from './anchoring'

const ROW_PX = 96
const key = (index: number) => `row-${index}`
const item = (index: number): VirtualItem => ({
  index,
  key: key(index),
  start: index * ROW_PX,
  size: ROW_PX,
  end: (index + 1) * ROW_PX,
  lane: 0,
})

// Rows 3 to 7 in view, with the fold at row 3's top; only the listed rows have a measured height.
function feedInView(measured: number[]) {
  const stub = {
    scrollOffset: 3 * ROW_PX,
    scrollAdjustments: 0,
    range: { startIndex: 3, endIndex: 7 },
    itemSizeCache: new Map(measured.map((index) => [key(index), ROW_PX])),
    options: { getItemKey: key },
  }
  return stub as unknown as Virtualizer<HTMLElement, Element>
}

test('a first height for a row a wheel up showed above the measured rows holds those rows', () => {
  expect(rowAboveReader(item(4), -40, feedInView([5, 6, 7]))).toBe(true)
})

test('a first height for a row below the first measured row in view leaves the reader in place', () => {
  expect(rowAboveReader(item(5), -40, feedInView([3, 4, 6]))).toBe(false)
})
