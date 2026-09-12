// The generated mirror is only true while somebody re-runs the generator. This is what makes a
// token added to the contract and never mirrored a failing suite rather than a design page that
// silently resolves it to nothing.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { derivedScale, mirrorContract, mirrorInks } from '../../../scripts/design-token-mirror.mjs'

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const contractPath = path.join(repositoryRoot, 'apps/desktop/src/renderer/styles/globals.css')
const inksPath = path.join(repositoryRoot, 'apps/desktop/src/renderer/tokens.css')
const mirrorPath = path.join(repositoryRoot, 'docs/design/tokens.css')

const CONTRACT = `@theme inline {
  --color-card: var(--card);
  --size-dock: 320px;
}
`

test('docs/design/tokens.css is what the contract generates today', async () => {
  const [contract, inks] = await Promise.all([
    readFile(contractPath, 'utf8'),
    readFile(inksPath, 'utf8'),
  ])
  assert.equal(await readFile(mirrorPath, 'utf8'), mirrorContract(contract, inks))
})

test('the derived scale carries every token @theme inline declares that is not a color', () => {
  const scale = derivedScale(CONTRACT)
  assert.equal(scale.includes('--size-dock: 320px;'), true)
  assert.equal(scale.includes('--color-card'), false)
})

test('the Sessions inks reach a design page as the dark root and the light override', () => {
  const [dark, light] = mirrorInks(
    '@theme {\n  --color-ink: #f2f4f6;\n}\n\n:root:not(.dark) {\n  --color-ink: var(--foreground);\n}\n',
  )
  assert.equal(dark, ':root {\n  --color-ink: #f2f4f6;\n}')
  assert.equal(light, ':root:not(.dark) {\n  --color-ink: var(--foreground);\n}')
})
