import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkComponentBase, stripComments } from './component-base.mjs'

const desktopRoot = path.resolve(import.meta.dirname, '..')

async function fixture(context, { style, component }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-component-base-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(
    path.join(root, 'components.json'),
    JSON.stringify({ style, aliases: { components: '@/components' } }),
  )
  await writeFile(
    path.join(root, 'tsconfig.json'),
    '{\n  // The renderer alias.\n  "compilerOptions": { "paths": { "@/*": ["./src/renderer/*"] } }\n}\n',
  )
  const directory = path.join(root, 'src', 'renderer', 'components', 'ui')
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'dialog.tsx'), component)
  return root
}

const breachPath = path.join('src', 'renderer', 'components', 'ui', 'dialog.tsx')

test('the shipped components import only the base components.json chooses', async () => {
  const result = await checkComponentBase(desktopRoot)
  assert.equal(result.allowed, '@base-ui/react')
  assert.deepEqual(result.breaches, [])
})

test('a component importing another primitive library fails the check', async (context) => {
  const root = await fixture(context, {
    style: 'base-nova',
    component: 'import { Dialog } from "radix-ui"\nexport { Dialog }\n',
  })
  assert.deepEqual((await checkComponentBase(root)).breaches, [
    { file: breachPath, specifier: 'radix-ui' },
  ])
})

test('a subpath of another primitive library fails the check', async (context) => {
  const root = await fixture(context, {
    style: 'base-nova',
    component: 'import * as D from "react-aria-components/dialog"\nexport { D }\n',
  })
  assert.equal((await checkComponentBase(root)).breaches.length, 1)
})

test('a type-only import of another primitive library fails the check', async (context) => {
  const root = await fixture(context, {
    style: 'radix-nova',
    component: 'import type { Props } from "@base-ui/react/dialog"\nexport type { Props }\n',
  })
  assert.deepEqual((await checkComponentBase(root)).breaches, [
    { file: breachPath, specifier: '@base-ui/react' },
  ])
})

test('the chosen base is never a breach', async (context) => {
  const root = await fixture(context, {
    style: 'base-nova',
    component: 'import { Dialog } from "@base-ui/react/dialog"\nexport { Dialog }\n',
  })
  assert.deepEqual((await checkComponentBase(root)).breaches, [])
})

test('a style naming no known base is refused rather than passed', async (context) => {
  const root = await fixture(context, { style: 'invented', component: 'export const x = 1\n' })
  await assert.rejects(checkComponentBase(root), /names no known primitive base/)
})

test('a components folder with nothing in it is refused rather than passed', async (context) => {
  const root = await fixture(context, { style: 'base-nova', component: 'export const x = 1\n' })
  await rm(path.join(root, 'src', 'renderer', 'components'), { recursive: true })
  await assert.rejects(checkComponentBase(root), /holds no component source/)
})

test('a components folder holding no source is refused rather than passed', async (context) => {
  const root = await fixture(context, { style: 'base-nova', component: 'export const x = 1\n' })
  const directory = path.join(root, 'src', 'renderer', 'components', 'ui')
  await rm(path.join(directory, 'dialog.tsx'))
  await writeFile(path.join(directory, 'README.md'), 'The components moved.\n')
  await assert.rejects(checkComponentBase(root), /holds no component source/)
})

test('a comment marker inside a string survives the JSONC strip', () => {
  assert.deepEqual(JSON.parse(stripComments('{"url": "https://a.example/b" /* c */}')), {
    url: 'https://a.example/b',
  })
})
