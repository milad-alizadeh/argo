// The checks that read documents rather than price them; called by audit-bloat.mjs.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(file, 'utf8')
const LINT_CONFIG =
  /(^|\/)(biome\.jsonc?|eslint\.config\.\w+|\.eslintrc(\.\w+)?|\.oxlintrc\.json|\.swiftlint\.yml|\.swiftformat|ruff\.toml|pyproject\.toml|setup\.cfg|\.golangci\.ya?ml|clippy\.toml|\.rubocop\.yml|detekt\.ya?ml|phpstan\.neon|\.editorconfig|\.jscpd\.json)$/
const ESCAPE_HATCH =
  /`(any|as!|try!|@ts-ignore|@ts-expect-error|biome-ignore|swiftlint:disable|eslint-disable|noqa|type: ignore|nolint|#\[allow|unsafe|rubocop:disable|@Suppress(Warnings)?|interface\{\})`/g
const CAP = /\b\d{1,3}\s*(lines?|parameters?|params|levels?|arguments?)\b/gi
const SELF_CHECK = /^#+ .*(self-check|checklist before you finish|before you finish)/im

function selfCheckBytes(text) {
  const start = text.search(SELF_CHECK)
  if (start === -1) return 0
  const rest = text.slice(start)
  const firstLine = rest.indexOf('\n') + 1
  const end = rest.slice(firstLine).search(/^#+ /m)
  return end === -1 ? rest.length : end + firstLine
}

function selfChecks({ corpus, rel, row, section }) {
  section('Self-check sections (restate the rules above them; delete)')
  for (const f of corpus) {
    const bytes = selfCheckBytes(read(f))
    if (bytes) row(String(bytes).padStart(9), rel(f))
  }
}

function historyDensity({ corpus, refsIn, rel, row, section }) {
  section(
    'Issue and PR references (history offered as justification; move to an ADR or the commit)',
  )
  for (const f of corpus) {
    const text = read(f)
    const hits = refsIn(text)
    const perKb = hits / (text.length / 1024)
    if (hits >= 5 || perKb >= 1) row(String(hits).padStart(9), rel(f), `${perKb.toFixed(1)}/KB`)
  }
}

function capsInProse({ root, rules, rel, row, section, walk }) {
  section('Caps and escape-hatch names in rules/ (a linter config may already gate them)')
  const lintConfigs = walk(root).filter((f) => LINT_CONFIG.test(f))
  console.log(`lint configs: ${lintConfigs.map(rel).join(', ') || 'none found'}`)
  for (const f of rules) {
    const text = read(f)
    const caps = [...new Set([...text.matchAll(CAP)].map((m) => m[0]))]
    const bans = [...text.matchAll(ESCAPE_HATCH)].length
    if (caps.length || bans) row(rel(f), `caps [${caps.join(', ')}]`, `escape-hatch names: ${bans}`)
  }
}

function sentencesOf(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((raw) => raw.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 90 && !s.startsWith('|') && !s.startsWith('```'))
}

function repeatedSentences({ corpus, rel, section }) {
  section('Sentences repeated across files (≥ 90 chars; name the survivor, re-point the rest)')
  const seen = new Map()
  for (const f of corpus) {
    for (const s of sentencesOf(read(f))) {
      const files = seen.get(s) ?? new Set()
      files.add(rel(f))
      seen.set(s, files)
    }
  }
  let dupBytes = 0
  for (const [s, files] of seen) {
    if (files.size < 2) continue
    dupBytes += s.length * (files.size - 1)
    console.log(`${files.size}× "${s.slice(0, 70)}…"\n    ${[...files].join('\n    ')}`)
  }
  console.log(`total duplicated: ${dupBytes} bytes`)
}

function churn({ root, row, section }) {
  section(
    'Agent documents touched by the most commits in the last 90 days (a changelog in disguise)',
  )
  const args = [
    'log',
    '--since=90 days ago',
    '--name-only',
    '--format=',
    '--',
    'rules',
    'AGENTS.md',
    'CLAUDE.md',
  ]
  let log = ''
  try {
    log = execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  } catch {
    console.log('git log unavailable')
    return
  }
  const counts = new Map()
  for (const line of log.split('\n').filter(Boolean)) counts.set(line, (counts.get(line) ?? 0) + 1)
  for (const [file, n] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6))
    row(String(n).padStart(9), file)
}

export function documentChecks(context) {
  selfChecks(context)
  historyDensity(context)
  capsInProse(context)
  repeatedSentences(context)
  churn(context)
}
