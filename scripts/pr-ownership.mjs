// The allowlist behind AGENTS.md, "Pushing and pull requests" (#1669): `/ship` is the only skill
// that pushes a work branch or opens a pull request.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// The source of truth for the bundle. `.claude/skills/` and `.agents/skills/` are gitignored
// installs of this directory, so scanning them would judge whatever the last `scaffold` left.
export const SKILLS = 'packages/argo-skills/skills'

// The two spellings, each with the files that may name it — paths relative to SKILLS. The
// asymmetry is the rule: only `ship` may open a PR, while three other files push something that
// is not a work branch. A path is allowed for the whole file, not for one step of it, so a
// second `git push` inside one of these three reads as allowed; a per-step allowlist would key
// on prose that moves.
export const ALLOWED = {
  'gh pr create': ['ship/SKILL.md'],
  'git push': [
    'ship/SKILL.md',
    // The evidence ref: a commit that sits on no branch, carrying PNGs for a body `gh` cannot
    // attach a file to. `setup-argo-skills` quotes the same recipe into a consumer's doc.
    'pixel-review/PR-EVIDENCE.md',
    'setup-argo-skills/SKILL.md',
    // Step 6, which drops `design/<screen>` once the screen has shipped.
    'design-to-code/SKILL.md',
  ],
}

// Matched over collapsed whitespace, so `gh  pr create` and a line-wrapped command are still the
// command. A spelling nothing here knows — `git -C <dir> push`, a `gh api` call against `/pulls`
// — is not caught, and no grep would catch the one built from a variable.
const asPattern = (command) => new RegExp(command.split(' ').join('\\s+'))

const markdownUnder = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.relative(dir, path.join(entry.parentPath ?? entry.path, entry.name)))
    .sort()

// `stale` is the other half of the check. An allowlisted file that has been renamed leaves an
// entry matching nothing, and the rename itself is then unguarded — a pass that looked at a path
// no longer there is the shape of a gate that exits 0 because nothing looked.
export function auditSkills(root = '.') {
  const dir = path.join(root, SKILLS)
  const files = markdownUnder(dir)
  const violations = []
  const stale = []
  for (const [command, allowed] of Object.entries(ALLOWED)) {
    const pattern = asPattern(command)
    for (const file of allowed) if (!files.includes(file)) stale.push({ command, file })
    for (const file of files) {
      if (allowed.includes(file)) continue
      const text = readFileSync(path.join(dir, file), 'utf8')
      text.split('\n').forEach((line, index) => {
        if (pattern.test(line)) violations.push({ command, file, line: index + 1 })
      })
    }
  }
  return { files, violations, stale }
}

export const describeAudit = ({ violations, stale }) =>
  [
    ...violations.map(
      ({ command, file, line }) => `${SKILLS}/${file}:${line} names \`${command}\``,
    ),
    ...stale.map(({ command, file }) => `the \`${command}\` allowlist names a missing ${file}`),
  ].join('\n')
