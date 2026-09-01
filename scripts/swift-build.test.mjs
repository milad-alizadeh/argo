#!/usr/bin/env node
// Tests for `apps/macOS/scripts/build.sh`, run via `bun run test:hooks`.
//
// One claim, in four shapes: the script builds the configuration it was ASKED for. Release is the
// only configuration that names `-O` (#998), so a typo that silently built Debug would hand back a
// figure presented as optimised and never measured — which is why the script refuses rather than
// guesses, and why the refusal is a check here rather than a comment there.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { check, report } from './check-harness.mjs'
import { run, STUBBED, scratch } from './swift-tooling.harness.mjs'

const BUILD = 'apps/macOS/scripts/build.sh'

const ASKED = [
  [undefined, 'Debug'],
  ['debug', 'Debug'],
  ['release', 'Release'],
  ['Release', null],
]
for (const [asked, expected] of ASKED) {
  check(
    `build.sh ${expected ?? 'refuses'} for ARGO_BUILD_CONFIGURATION=${asked ?? '(unset)'}`,
    () => {
      const env = asked ? { ARGO_BUILD_CONFIGURATION: asked } : {}
      const result = run(BUILD, { ...STUBBED, env })
      if (!expected) {
        assert.equal(result.status, 1, result.output)
        assert.match(result.output, /must be debug or release/)
        // And it refuses BEFORE reaching xcodebuild, rather than after starting a build.
        assert.deepEqual(result.argv, [])
        return
      }
      // The flag and its value adjacent, so a reordering that pairs it with something else fails.
      const flag = result.argv.indexOf('-configuration')
      assert.equal(result.argv[flag + 1], expected, result.argv.join(' '))
    },
  )
}

rmSync(scratch, { recursive: true, force: true })

report('swift build')
