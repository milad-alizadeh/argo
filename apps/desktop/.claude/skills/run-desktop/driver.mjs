#!/usr/bin/env node
// Launch the built Electron cockpit, screenshot it, and optionally inspect the
// renderer — the agent's headless path to "see the app running". Mirrors the
// `_electron` launch harness used by e2e/*.spec.ts (out/main/index.js entry,
// ELECTRON_DISABLE_SANDBOX for display-less CI). Flags are documented in SKILL.md.

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
// The skill lives at apps/desktop/.claude/skills/run-desktop; the app root is three up.
const appRoot = resolve(here, '..', '..', '..')
const mainEntry = join(appRoot, 'out', 'main', 'index.js')

function flag(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}
function has(name) {
  return process.argv.includes(`--${name}`)
}

const outPath = resolve(process.cwd(), flag('out') ?? 'run-desktop.png')
const waitFor = flag('wait') ?? 'cockpit-root'
const testid = flag('testid')
const evalExpr = flag('eval')
const seed = has('seed')

const env = { ...process.env, ELECTRON_DISABLE_SANDBOX: '1' }
if (seed) env.ARGO_SEED_DEMO = '1'

const app = await electron.launch({ args: [mainEntry], env })
try {
  const window = await app.firstWindow()
  await window.getByTestId(waitFor).waitFor({ state: 'visible', timeout: 15_000 })

  await window.screenshot({ path: outPath })
  console.log(`title:      ${await window.title()}`)
  console.log(`screenshot: ${outPath}`)

  if (testid) {
    console.log(`testid ${testid}: ${await window.getByTestId(testid).innerText()}`)
  }
  if (evalExpr) {
    // biome-ignore lint/security/noGlobalEval: renderer-side inspection is the point of this dev-only driver.
    const result = await window.evaluate((expr) => eval(expr), evalExpr)
    console.log(`eval:       ${JSON.stringify(result)}`)
  }
} finally {
  await app.close()
}
