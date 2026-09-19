import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { WINDOW_MINIMUM_WIDTH } from '@/platform/main/window/minimum-width'

const HANDLE = 1

async function token(name: string) {
  const contract = await readFile(
    path.join(import.meta.dirname, '../../renderer/tokens.css'),
    'utf8',
  )
  const match = contract.match(new RegExp(`--${name}: (\\d+)px;`))
  assert.ok(match, `--${name} is a pixel token`)
  return Number(match[1])
}

test('the window is never narrower than the rail, the sidebar and the content at their minimums', async () => {
  const widths = await Promise.all(
    ['size-navigation-rail', 'size-cockpit-sidebar-min', 'size-cockpit-content-min'].map(token),
  )
  assert.equal(
    WINDOW_MINIMUM_WIDTH,
    widths.reduce((sum, width) => sum + width, HANDLE),
  )
})
