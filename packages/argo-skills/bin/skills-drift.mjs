#!/usr/bin/env node
// Drift check for the third-party skill sources in bundle.json.
//
// Compares each tracked SKILL.md's upstream git blob SHA (source repo HEAD)
// against drift-baseline.json. The skills-lock hash is opaque to us, so we keep
// our own baseline. Entries with "watch": true are tracked even when not
// installed — that's how Argo's forks (e.g. implement) keep an eye on their
// upstream original.
//
// Exit codes: 0 clean, 1 drift found (CI files an issue), 2 infrastructure
// failure. After reviewing drift — and porting anything worth keeping into the
// forked skills — accept the new state with:
//   node packages/argo-skills/bin/skills-drift.mjs --update
// and commit drift-baseline.json.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OWN_SOURCE = 'milad-alizadeh/argo'
// Sources whose catalog we browse for adoption; new skills elsewhere are noise.
const REPORT_NEW = new Set(['mattpocock/skills'])

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(pkgRoot, 'drift-baseline.json')
const update = process.argv.includes('--update')

const gh = (endpoint) =>
  JSON.parse(
    execFileSync('gh', ['api', endpoint], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  )

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const sortedByKey = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))

try {
  const bundle = readJson(path.join(pkgRoot, 'bundle.json'), null)
  if (!bundle) throw new Error('bundle.json not found or unparsable')
  const baseline = readJson(baselinePath, {})
  const nextBaseline = {}
  const report = []
  let drift = false

  for (const entry of bundle.bundle) {
    if (entry.source === OWN_SOURCE) continue
    const sourceBaseline = baseline[entry.source] ?? {}
    const defaultBranch = gh(`repos/${entry.source}`).default_branch
    const tree = gh(`repos/${entry.source}/git/trees/${defaultBranch}?recursive=1`)

    // name -> { path, sha }, from every */SKILL.md blob in the source repo
    const upstream = new Map()
    for (const node of tree.tree) {
      if (node.type !== 'blob' || !node.path.endsWith('/SKILL.md')) continue
      upstream.set(path.basename(path.dirname(node.path)), {
        path: node.path,
        sha: node.sha,
      })
    }

    const excluded = new Set([].concat(entry.exclude ?? []))
    const pinned = (entry.skills === '*' ? [...upstream.keys()] : (entry.skills ?? [])).filter(
      (name) => !excluded.has(name),
    )
    const watched = Object.keys(sourceBaseline).filter((name) => sourceBaseline[name].watch)
    const tracked = [...new Set([...pinned, ...watched])].sort()

    const lines = []
    const historyUrl = (p) => `https://github.com/${entry.source}/commits/${defaultBranch}/${p}`
    nextBaseline[entry.source] = {}

    for (const name of tracked) {
      const known = sourceBaseline[name]
      const head = upstream.get(name)
      const label = known?.watch ? `${name} (watched fork upstream)` : name

      if (!head) {
        drift = true
        lines.push(
          pinned.includes(name)
            ? `- **${name} vanished upstream** — the installer will break; drop it from bundle.json or find where it moved`
            : `- ${label} vanished upstream`,
        )
        continue
      }
      const record = { path: head.path, sha: head.sha }
      if (known?.watch) record.watch = true
      nextBaseline[entry.source][name] = record

      if (!known?.sha) {
        if (!update) {
          drift = true
          lines.push(`- ${label} has no baseline — run \`--update\` to seed it`)
        }
      } else if (known.sha !== head.sha) {
        drift = true
        lines.push(`- **${label} changed** — [file history](${historyUrl(head.path)})`)
      } else if (known.path !== head.path) {
        drift = true
        lines.push(
          `- ${label} moved \`${known.path}\` → \`${head.path}\` (content unchanged; reinstall may re-pin the path)`,
        )
      }
    }

    if (tree.truncated) {
      drift = true
      lines.push('- upstream tree listing was truncated by the API; results are incomplete')
    }

    if (REPORT_NEW.has(entry.source)) {
      const trackedSet = new Set(tracked)
      for (const name of [...upstream.keys()].sort()) {
        // sourceBaseline check: --update records unadopted skills as seen, so
        // they report as new once, not on every run.
        if (trackedSet.has(name) || excluded.has(name) || sourceBaseline[name]) continue
        drift = true
        lines.push(
          `- new upstream skill \`${name}\` — adopt in bundle.json or accept via \`--update\``,
        )
      }
      // Accepting via --update records it as seen without installing it.
      for (const name of upstream.keys()) {
        if (!nextBaseline[entry.source][name]) {
          const head = upstream.get(name)
          nextBaseline[entry.source][name] = { path: head.path, sha: head.sha }
        }
      }
    }

    if (lines.length > 0) report.push(`### ${entry.source}`, ...lines, '')
  }

  if (update) {
    writeFileSync(
      baselinePath,
      `${JSON.stringify(sortedByKey(Object.fromEntries(Object.entries(nextBaseline).map(([source, skills]) => [source, sortedByKey(skills)]))), null, 2)}\n`,
    )
    console.log(`baseline written to ${baselinePath} — commit it`)
    process.exit(0)
  }

  if (drift) {
    console.log('## Upstream skills drifted\n')
    console.log(report.join('\n'))
    console.log(
      'Review the upstream diffs, port anything worth keeping into the forked skills, then run `node packages/argo-skills/bin/skills-drift.mjs --update` and commit `drift-baseline.json`.',
    )
    process.exit(1)
  }
  console.log('No drift — upstream skill sources match the baseline.')
} catch (error) {
  console.error(`drift check failed: ${error.message}`)
  process.exit(2)
}
