import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const desktopRoot = path.resolve(import.meta.dirname, '..')
const scripts = JSON.parse(readFileSync(path.join(desktopRoot, 'package.json'), 'utf8')).scripts

test('names every packaged test command as a test', () => {
  expect(scripts['test:packaged-contents']).toContain('scripts/assert-packaged-pty.mjs')
  expect(scripts['test:packaged-manifest']).toBe('bun run desktop:manifest')
  expect(scripts['test:packaged-pty']).toContain('scripts/prove-packaged-pty.mjs')
  expect(scripts['test:e2e']).toBe('playwright test')
  for (const oldName of [
    'assert:packaged',
    'prove:pty',
    'prove:project-contract',
    'prove:session',
    'test:packaged-project',
    'test:packaged-session',
    'test:packaged-journeys',
    'test:packaged-tickets',
  ])
    expect(scripts[oldName], `${oldName} remains public`).toBeUndefined()
})
