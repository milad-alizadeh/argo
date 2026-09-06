// The fixture behind `linter-cache.test.mjs`, built on the repository `step-cache.harness.mjs`
// makes.
//
// Two of the three Swift linters also run from lint-staged over the STAGED paths, so this has
// to be able to ask them both ways: whole tree, and named files. `swift-lint.sh` refuses a tree
// with no `.swiftlint.yml` before it reaches anything else, so the configs are part of the
// fixture rather than of a case.
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scenario } from './step-cache.harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function linterScenario() {
  const s = scenario()
  for (const file of ['scripts/swift-format.sh', 'scripts/swift-lint.sh']) {
    writeFileSync(path.join(s.dir, file), readFileSync(path.join(ROOT, file), 'utf8'))
  }
  writeFileSync(path.join(s.dir, 'apps/macOS/.swiftlint.yml'), 'disabled_rules: []\n')
  writeFileSync(path.join(s.dir, 'apps/macOS/.swiftformat'), '--indent 4\n')
  const log = path.join(s.dir, 'linter.log')
  for (const tool of ['swiftformat', 'swiftlint']) {
    writeFileSync(
      path.join(s.bin, tool),
      `#!/bin/sh\necho "${tool} $*" >> ${JSON.stringify(log)}\nexit \${STUB_LINT_STATUS:-0}\n`,
    )
  }
  execFileSync('chmod', ['+x', path.join(s.bin, 'swiftformat'), path.join(s.bin, 'swiftlint')])
  s.vcs('add', '-A')
  s.vcs('commit', '-qm', 'linters')
  return {
    ...s,
    linted: (tool) => (readFileSync(log, 'utf8').match(new RegExp(`^${tool} `, 'gm')) ?? []).length,
    lint: (script, args = [], env = {}) =>
      spawnSync('sh', [path.join(s.dir, 'scripts', script), ...args], {
        cwd: s.dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${s.bin}:/usr/bin:/bin`,
          ARGO_GATE_CACHE_DIR: path.join(s.dir, 'cache'),
          ARGO_METRICS_FILE: path.join(s.dir, 'metrics.tsv'),
          ...env,
        },
      }),
  }
}
