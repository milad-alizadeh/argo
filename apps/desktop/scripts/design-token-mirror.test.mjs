// The generated mirror is only true while somebody re-runs the generator. This is what makes a
// token added to the contract and never mirrored a failing suite rather than a design page that
// silently resolves it to nothing.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import {
  derivedScale,
  mirrorContract,
  readContract,
} from '../../../scripts/design-token-mirror.mjs'

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const contractPath = path.join(repositoryRoot, 'apps/desktop/src/renderer/styles/globals.css')
const mirrorPath = path.join(repositoryRoot, 'docs/design/tokens.css')

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

test('the derived scale carries measurements, color aliases, and named colors', () => {
  const scale = derivedScale(CONTRACT)
  assert.equal(scale.includes('--size-dock: 320px;'), true)
  assert.equal(scale.includes('--color-card: var(--card);'), true)
  assert.equal(scale.includes('--color-traffic-light-close: #ff5f57;'), true)
})

test('the mirror includes imported Session tokens in declaration order', () => {
  const mirror = mirrorContract(readContract(contractPath))
  for (const declaration of [
    '--color-traffic-light-close: #ff5f57;',
    '--color-traffic-light-minimize: #febc2e;',
    '--color-traffic-light-zoom: #28c840;',
    '--text-session-body: var(--text-sm, 0.875rem);',
  ]) {
    assert.equal(mirror.includes(declaration), true, declaration)
  }
  assert.ok(mirror.indexOf('--color-traffic-light-close') < mirror.indexOf('--background:'))
  assert.equal(mirror.includes('@import'), false)
  assert.equal(mirror.includes('@theme'), false)
})
