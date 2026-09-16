// Bundles one tool with bun, then runs the bundle under node with any arguments after the entry.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const [entry, ...toolArguments] = process.argv.slice(2)
const outfile = path.join('out', 'tools', `${path.basename(entry, '.ts')}.mjs`)
const steps = [
  [
    'bun',
    [
      'build',
      entry,
      '--target=node',
      '--format=esm',
      '--packages=external',
      '--external=playwright-core',
      '--external=chromium-bidi',
      `--outfile=${outfile}`,
    ],
  ],
  [process.execPath, [outfile, ...toolArguments]],
]
for (const [command, commandArguments] of steps) {
  const { status } = spawnSync(command, commandArguments, { stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}
