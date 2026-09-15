// The generated mirror must track every token contract change.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { textSizeSource } from '../../../scripts/design-token-class-groups.mjs'
import {
  derivedScale,
  mirrorContract,
  readContract,
} from '../../../scripts/design-token-mirror.mjs'

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const contractPath = path.join(repositoryRoot, 'apps/desktop/src/renderer/tokens.css')
const globalStylesPath = path.join(repositoryRoot, 'apps/desktop/src/renderer/styles/globals.css')
const mirrorPath = path.join(repositoryRoot, 'docs/design/tokens.css')
const textSizesPath = path.join(repositoryRoot, 'apps/desktop/src/renderer/lib/text-sizes.ts')

const CONTRACT = `@theme inline {
  --color-card: var(--card);
  --color-traffic-light-close: #ff5f57;
  --size-dock: 320px;
}
`

test('docs/design/tokens.css is what the contract generates today', async () => {
  const contract = readContract(contractPath)
  assert.equal(await readFile(mirrorPath, 'utf8'), mirrorContract(contract))
})

test('global styles do not declare design tokens', async () => {
  const globalStyles = await readFile(globalStylesPath, 'utf8')
  assert.doesNotMatch(globalStyles, /--[\\w-]+:/)
})

test('the cn text-size table is generated from the token contract', async () => {
  const contract = readContract(contractPath)
  assert.equal(await readFile(textSizesPath, 'utf8'), textSizeSource(contract))
})

test('the derived scale carries measurements, color aliases, and named colors', () => {
  const scale = derivedScale(CONTRACT)
  assert.equal(scale.includes('--size-dock: 320px;'), true)
  assert.equal(scale.includes('--color-card: var(--card);'), true)
  assert.equal(scale.includes('--color-traffic-light-close: #ff5f57;'), true)
})

test('the mirror includes Session tokens in declaration order', () => {
  const mirror = mirrorContract(readContract(contractPath))
  for (const declaration of [
    '--color-traffic-light-close: #ff5f57;',
    '--color-traffic-light-minimize: #febc2e;',
    '--color-traffic-light-zoom: #28c840;',
    '--text-session-body: var(--text-base, 1rem);',
  ]) {
    assert.equal(mirror.includes(declaration), true, declaration)
  }
  assert.ok(mirror.indexOf('--color-traffic-light-close') < mirror.indexOf('--background:'))
  assert.equal(mirror.includes('@import'), false)
  assert.equal(mirror.includes('@theme'), false)
})

test('the Sessions inks retain their dark root and light override', () => {
  const mirror = mirrorContract(readContract(contractPath))
  assert.equal(mirror.includes('--color-ink: #f2f4f6;'), true)
  assert.equal(mirror.includes(':root:not(.dark) {\n  --color-ink: var(--foreground);'), true)
})
