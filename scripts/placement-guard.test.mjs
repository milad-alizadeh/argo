#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the placement write-time guardrail, run via `bun run test:hooks`.
// Mirrors worktree-guard.test.mjs: soften the script and this test together, never one alone.
// The deny cases are the point — every one of them is a file that would otherwise reach the
// build gate minutes later with imports already pointing at it.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { decide, findWorkspace } from './placement-guard.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOOK = path.join(HERE, 'placement-guard.mjs')
const WS = '/repo/apps/desktop'

const MAP = {
  modules: [
    { name: 'main', path: '^src/main/' },
    { name: 'renderer', path: '^src/renderer/' },
    { name: 'shell', path: '^src/renderer/src/shell/' },
    { name: 'rooms-work', path: '^src/renderer/src/rooms/work/' },
  ],
  placement: {
    rootFiles: {
      modules: {
        main: { allow: { 'index.ts': 'KIND — the entry.' } },
        renderer: { path: '^src/renderer/src/[^/]+$', allow: { 'App.tsx': 'KIND — container.' } },
        shell: { allow: {}, ratchet: { 'shellModel.ts': 'RATCHET — belongs in top-bar/.' } },
        'rooms-work': { allow: {}, ratchet: {} },
      },
    },
  },
}

// Nothing on disk unless a case says so: every guarded path is a NEW file.
const write = (filePath, extra) =>
  decide({
    filePath,
    cwd: WS,
    isAgent: true,
    workspace: WS,
    map: MAP,
    exists: () => false,
    ...extra,
  })

// Blocked: a new file loose at a module root.
check('blocks a new file at main/ root', () =>
  assert.equal(write('src/main/newThing.ts').block, true),
)
check('blocks a new file at a NESTED module root', () =>
  assert.equal(write('src/renderer/src/shell/newModel.ts').block, true),
)
check('blocks at the renderer root via its path override', () =>
  assert.equal(write('src/renderer/src/Loose.tsx').block, true),
)
check('blocks an absolute path the same way', () =>
  assert.equal(write(`${WS}/src/main/newThing.ts`).block, true),
)
check('names the module and what its root holds', () => {
  const { reason } = write('src/main/newThing.ts')
  assert.match(reason, /module "main"/)
  assert.match(reason, /index\.ts/)
})
check('a closed root says so rather than listing nothing', () =>
  assert.match(write('src/renderer/src/rooms/work/x.ts').reason, /this root is closed/),
)
check('an unbuilt module is guarded from its FIRST file', () =>
  assert.equal(write('src/renderer/src/rooms/work/WorkRoom.tsx').block, true),
)

// Allowed: everything that is not a new placement at a root.
check('allows a file inside a sub-domain', () =>
  assert.equal(write('src/main/terminals/newThing.ts').block, false),
)
check('allows a KIND-allowed basename', () => assert.equal(write('src/main/index.ts').block, false))
check('allows a RATCHET-listed basename', () =>
  assert.equal(write('src/renderer/src/shell/shellModel.ts').block, false),
)
check('allows overwriting a file that already exists (not a placement)', () =>
  assert.equal(write('src/main/newThing.ts', { exists: () => true }).block, false),
)
check('allows a path in no declared module', () =>
  assert.equal(write('e2e/launch.spec.ts').block, false),
)
check('allows a path outside the workspace', () =>
  assert.equal(write('/elsewhere/x.ts').block, false),
)

// Fail-open: the build gate is the backstop, so nothing here may wedge a session.
check('never guards a human', () =>
  assert.equal(write('src/main/newThing.ts', { isAgent: false }).block, false),
)
check('fails open with no map', () =>
  assert.equal(write('src/main/newThing.ts', { map: null }).block, false),
)
check('fails open with no workspace', () =>
  assert.equal(write('src/main/newThing.ts', { workspace: null }).block, false),
)
check('fails open on a map with no modules', () =>
  assert.equal(write('src/main/newThing.ts', { map: {} }).block, false),
)

// The workspace walk stops at the root rather than looping.
check('findWorkspace returns null when no map is found', () =>
  assert.equal(
    findWorkspace('/repo/apps/desktop/src/main/x.ts', () => false),
    null,
  ),
)
check('findWorkspace finds the nearest ancestor holding a map', () =>
  assert.equal(
    findWorkspace(
      '/repo/apps/desktop/src/main/x.ts',
      (p) => p === '/repo/apps/desktop/scripts/module-boundaries.json',
    ),
    '/repo/apps/desktop',
  ),
)

// The end-to-end pair runs the script for real, so it needs a map ON DISK. It builds a temp
// workspace rather than borrowing one this repo ships: the guard is a property of any tree
// holding a module map, and the last one here left with the Electron cockpit — a test anchored
// to whichever app exists today dies the next time one is retired.
const ROOT = mkdtempSync(path.join(tmpdir(), 'placement-guard-'))
const SCRATCH = path.join(ROOT, 'apps', 'app')
mkdirSync(path.join(SCRATCH, 'scripts'), { recursive: true })
writeFileSync(path.join(SCRATCH, 'scripts', 'module-boundaries.json'), JSON.stringify(MAP))

const runHook = (filePath) =>
  execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: path.join(SCRATCH, filePath) },
      cwd: SCRATCH,
    }),
    env: { ...process.env, CLAUDECODE: '1' },
    encoding: 'utf8',
  })

check('script denies a new file at a module root', () =>
  assert.equal(
    JSON.parse(runHook('src/main/scratchpad.ts')).hookSpecificOutput.permissionDecision,
    'deny',
  ),
)

// An allowed write produces no output (silent allow).
check('script stays silent for a file inside a sub-domain', () =>
  assert.equal(runHook('src/main/terminals/scratchpad.ts').trim(), ''),
)

rmSync(ROOT, { recursive: true, force: true })

report('placement-guard')
