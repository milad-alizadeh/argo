// The checks that read documents rather than price them; called by audit-bloat.mjs.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { read, row, section, walk } from './report.mjs'
import { refsIn } from './sections.mjs'

const LINT_CONFIG =
  /(^|\/)(biome\.jsonc?|eslint\.config\.\w+|\.eslintrc(\.\w+)?|\.oxlintrc\.json|\.swiftlint\.yml|\.swiftformat|ruff\.toml|pyproject\.toml|setup\.cfg|\.golangci\.ya?ml|clippy\.toml|\.rubocop\.yml|detekt\.ya?ml|phpstan\.neon|\.editorconfig|\.jscpd\.json)$/
const ESCAPE_HATCH =
  /`(any|as!|try!|@ts-ignore|@ts-expect-error|biome-ignore|swiftlint:disable|eslint-disable|noqa|type: ignore|nolint|#\[allow|unsafe|rubocop:disable|@Suppress(Warnings)?|interface\{\})`/g
const CAP = /\b\d{1,3}[ \t]*(lines?|parameters?|params|levels?|arguments?)\b/gi
const SELF_CHECK = /^#+ .*(self-check|checklist before you finish|before you finish)/im
const HISTORY_HITS = 5
const HISTORY_HITS_PER_KILOBYTE = 1
const REPEATED_SENTENCE_CHARS = 90
const CHURN_DAYS = 90
const CHURN_ROWS = 6

function duplicateRoots({ root, relative }) {
  section('Duplicate root files (the same body under two names is paid twice)')
  const roots = ['CLAUDE.md', 'AGENTS.md'].map((name) => path.join(root, name)).filter(existsSync)
  if (roots.length === 2 && read(roots[0]).trim() === read(roots[1]).trim())
    row(String(read(roots[0]).length).padStart(9), roots.map(relative).join(' = '))
}

function selfCheckBytes(text) {
  const start = text.search(SELF_CHECK)
  if (start === -1) return 0
  const rest = text.slice(start)
  const firstLine = rest.indexOf('\n') + 1
  const end = rest.slice(firstLine).search(/^#+ /m)
  return end === -1 ? rest.length : end + firstLine
}

function selfChecks({ corpus, relative }) {
  section('Self-check sections (restate the rules above them; delete)')
  for (const file of corpus) {
    const bytes = selfCheckBytes(read(file))
    if (bytes) row(String(bytes).padStart(9), relative(file))
  }
}

function historyDensity({ corpus, relative }) {
  section(
    'Issue and PR references (history offered as justification; move to an ADR or the commit)',
  )
  for (const file of corpus) {
    const text = read(file)
    const hits = refsIn(text)
    const hitsPerKilobyte = hits / (text.length / 1024)
    if (hits >= HISTORY_HITS || hitsPerKilobyte >= HISTORY_HITS_PER_KILOBYTE)
      row(String(hits).padStart(9), relative(file), `${hitsPerKilobyte.toFixed(1)}/KB`)
  }
}

function capsInProse({ root, rules, relative }) {
  section('Caps and escape-hatch names in rules/ (a linter config may already gate them)')
  const lintConfigs = walk(root).filter((file) => LINT_CONFIG.test(file))
  console.log(`lint configs: ${lintConfigs.map(relative).join(', ') || 'none found'}`)
  for (const file of rules) {
    const text = read(file)
    const caps = [...new Set([...text.matchAll(CAP)].map((match) => match[0]))]
    const bans = [...text.matchAll(ESCAPE_HATCH)].length
    if (caps.length || bans)
      row(relative(file), `caps [${caps.join(', ')}]`, `escape-hatch names: ${bans}`)
  }
}

function sentencesOf(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((raw) => raw.replace(/\s+/g, ' ').trim())
    .filter(
      (sentence) =>
        sentence.length >= REPEATED_SENTENCE_CHARS &&
        !sentence.startsWith('|') &&
        !sentence.startsWith('```'),
    )
}

function repeatedSentences({ corpus, relative }) {
  section(
    `Sentences repeated across files (≥ ${REPEATED_SENTENCE_CHARS} chars; name the survivor, re-point the rest)`,
  )
  const sites = new Map()
  for (const file of corpus) {
    for (const sentence of sentencesOf(read(file))) {
      const files = sites.get(sentence) ?? new Set()
      files.add(relative(file))
      sites.set(sentence, files)
    }
  }
  let duplicatedBytes = 0
  for (const [sentence, files] of sites) {
    if (files.size < 2) continue
    duplicatedBytes += sentence.length * (files.size - 1)
    console.log(`${files.size}× "${sentence.slice(0, 70)}…"\n    ${[...files].join('\n    ')}`)
  }
  console.log(`total duplicated: ${duplicatedBytes} bytes`)
}

function churn({ root }) {
  section(
    `Agent documents touched by the most commits in the last ${CHURN_DAYS} days (a changelog in disguise)`,
  )
  const args = ['log', `--since=${CHURN_DAYS} days ago`, '--name-only', '--format=']
  let log = ''
  try {
    log = execFileSync('git', [...args, '--', 'rules', 'AGENTS.md', 'CLAUDE.md'], {
      cwd: root,
      encoding: 'utf8',
    })
  } catch {
    // Not a git checkout (an archive, a bare copy): the check has no input, not a failure.
    console.log('git log unavailable')
    return
  }
  const counts = new Map()
  // A path deleted since is history, not a document that can still grow.
  for (const line of log.split('\n').filter((file) => file && existsSync(path.join(root, file))))
    counts.set(line, (counts.get(line) ?? 0) + 1)
  for (const [file, commits] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, CHURN_ROWS))
    row(String(commits).padStart(9), file)
}

export function documentChecks(context) {
  duplicateRoots(context)
  selfChecks(context)
  historyDensity(context)
  capsInProse(context)
  repeatedSentences(context)
  churn(context)
}
