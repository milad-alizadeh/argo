import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const workflow = readFileSync(resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8')

function namedStep(name: string): string {
  const namePosition = workflow.indexOf(`name: ${name}`)
  assert.notEqual(namePosition, -1, `CI has a ${name} step`)
  const start = workflow.lastIndexOf('\n      - ', namePosition)
  const end = workflow.indexOf('\n      - ', namePosition)
  return workflow.slice(start, end === -1 ? undefined : end)
}

function condition(name: string): string | null {
  return namedStep(name).match(/^\s+if: (.+)$/m)?.[1] ?? null
}

test('prepares Playwright whenever Storybook coverage launches a browser', () => {
  const coverageCondition = condition('Coverage report (Storybook interaction tests)')
  const setupSteps = [
    'Read the Playwright version',
    'Playwright browser cache',
    'Install Chromium for Storybook interaction tests',
  ]

  for (const step of setupSteps) {
    assert.equal(condition(step), coverageCondition)
  }
})
