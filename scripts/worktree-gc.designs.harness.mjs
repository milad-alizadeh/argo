// The fixture behind `worktree-gc.designs.test.mjs`: a repository whose `origin` is a real bare repo
// on disk, seeded with design `.md` files and `design/<screen>` branches, with `gh` stubbed on
// PATH.
//
// A real remote rather than a fake one, because the sweep reads the default branch through
// `origin/<default>` and deletes through `git push origin --delete` — a stand-in would prove
// neither half. `gh` is stubbed on PATH rather than mocked inside the script: the script decides
// what to ask it, and a stub is the only way a case can be wrong about that and still fail.
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url))

const git = (cwd, ...args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    // Captured rather than inherited: cloning an empty bare repo warns, and a suite's output
    // is read by a human looking for the FAIL lines.
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'T',
      GIT_AUTHOR_EMAIL: 't@e',
      GIT_COMMITTER_NAME: 'T',
      GIT_COMMITTER_EMAIL: 't@e',
    },
  })

// One front-matter comment, in the shape `prototype-to-design` writes. `epic` is optional so a
// case can leave it out; `explorable` is what names the branch.
const design = ({ explorable, epic }) =>
  [
    '<!-- status: approved',
    '     approved-at: abc1234',
    explorable ? `     explorable: ${explorable}` : null,
    epic ? `     epic: #${epic}` : null,
    '     -->',
    '',
    '# A screen',
    '',
    'Measurements go here.',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n')

export function scenario({ designs = {}, issues = {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-design-'))
  const origin = path.join(root, 'origin.git')
  const work = path.join(root, 'work')
  const bin = path.join(root, 'bin')

  git(root, 'init', '--bare', '--initial-branch=main', origin)
  git(root, 'clone', '--quiet', origin, work)

  mkdirSync(path.join(work, 'scripts'), { recursive: true })
  copyFileSync(path.join(SCRIPTS, 'worktree-gc.sh'), path.join(work, 'scripts/worktree-gc.sh'))
  mkdirSync(path.join(work, 'docs/designs'), { recursive: true })
  for (const [name, front] of Object.entries(designs)) {
    writeFileSync(path.join(work, 'docs/designs', name), design(front))
  }
  git(work, 'add', '-A')
  git(work, 'commit', '--quiet', '-m', 'seed')
  git(work, 'push', '--quiet', 'origin', 'main')
  git(work, 'remote', 'set-head', 'origin', 'main')

  mkdirSync(bin)
  const gh = path.join(bin, 'gh')
  // Answers only what the sweep asks. `issue view <n>` prints the state this case gave that
  // number and exits 1 for any other, which is how "the query failed" is expressed.
  writeFileSync(
    gh,
    [
      '#!/bin/sh',
      'if [ "$1" = "pr" ]; then exit 0; fi',
      'if [ "$1" = "issue" ] && [ "$2" = "view" ]; then',
      '  case "$3" in',
      ...Object.entries(issues).map(([n, state]) => `    ${n}) echo ${state}; exit 0 ;;`),
      '    *) exit 1 ;;',
      '  esac',
      'fi',
      'exit 1',
      '',
    ].join('\n'),
  )
  chmodSync(gh, 0o755)

  return {
    work,
    origin,
    // Push a branch to the origin under whatever name, from the seed commit.
    branch(name) {
      git(work, 'push', '--quiet', 'origin', `HEAD:refs/heads/${name}`)
    },
    remoteBranches() {
      return git(work, 'ls-remote', '--heads', 'origin')
        .split('\n')
        .map((line) => line.split('refs/heads/')[1])
        .filter(Boolean)
    },
    run(...args) {
      return execFileSync('sh', [path.join(work, 'scripts/worktree-gc.sh'), ...args], {
        cwd: work,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      })
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true })
    },
  }
}
