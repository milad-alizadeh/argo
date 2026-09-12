import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const git = (cwd, args) => execFileSync('git', args, { cwd, stdio: 'pipe' })
const hookDirectory = path.dirname(fileURLToPath(import.meta.url))
const repository = path.dirname(hookDirectory)
const hook = path.join(hookDirectory, 'worktree-guard.mjs')

function fixture(context, name) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'argo-worktree-skills-'))
  context.after(() => rmSync(root, { recursive: true, force: true }))

  const primary = path.join(root, 'project')
  const worktree = path.join(primary, '.claude', 'worktrees', name)
  mkdirSync(path.join(primary, '.agents', 'skills', 'example'), { recursive: true })
  mkdirSync(path.join(primary, '.claude', 'skills'), { recursive: true })
  writeFileSync(path.join(primary, '.agents', 'skills', 'example', 'SKILL.md'), 'current\n')
  symlinkSync('../../.agents/skills/example', path.join(primary, '.claude', 'skills', 'example'))
  git(primary, ['init'])
  writeFileSync(path.join(primary, 'tracked'), 'initial\n')
  git(primary, ['add', 'tracked'])
  git(primary, [
    '-c',
    'user.name=Argo Test',
    '-c',
    'user.email=argo@example.test',
    'commit',
    '-m',
    'initial',
  ])
  git(primary, ['worktree', 'add', '-b', `argo/${name}`, worktree])
  return { primary, worktree }
}

function runHook(primary, worktree, isAgent = true) {
  const environment = { ...process.env }
  delete environment.CLAUDECODE
  delete environment.ARGO_HOOK_AGENT
  if (isAgent) environment.ARGO_HOOK_AGENT = '1'
  const result = spawnSync(process.execPath, [hook], {
    cwd: primary,
    env: environment,
    encoding: 'utf8',
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: {
        command: `rtk git worktree add -b argo/skill-copy ${worktree}`,
      },
      cwd: primary,
    }),
  })
  assert.equal(result.status, 0, result.stderr)
}

test('a new worktree mirrors the primary checkout skills', (context) => {
  const { primary, worktree } = fixture(context, 'ticket-skill-copy')
  mkdirSync(path.join(worktree, '.agents', 'skills', 'obsolete'), { recursive: true })
  writeFileSync(path.join(worktree, '.agents', 'skills', 'obsolete', 'SKILL.md'), 'stale\n')

  runHook(primary, worktree)

  assert.equal(
    readFileSync(path.join(worktree, '.agents', 'skills', 'example', 'SKILL.md'), 'utf8'),
    'current\n',
  )
  assert.equal(
    readlinkSync(path.join(worktree, '.claude', 'skills', 'example')),
    '../../.agents/skills/example',
  )
  assert.equal(existsSync(path.join(worktree, '.agents', 'skills', 'obsolete')), false)
})

test('the post hook leaves a human-created worktree unchanged', (context) => {
  const { primary, worktree } = fixture(context, 'ticket-human-copy')

  runHook(primary, worktree, false)

  assert.equal(existsSync(path.join(worktree, '.agents', 'skills')), false)
})

test('both harnesses copy skills after a successful Bash tool', () => {
  for (const relative of ['.claude/settings.json', '.codex/hooks.json']) {
    const configuration = JSON.parse(readFileSync(path.join(repository, relative), 'utf8'))
    const handlers = configuration.hooks.PostToolUse.flatMap((group) => group.hooks)
    assert.equal(configuration.hooks.PostToolUse[0].matcher, 'Bash')
    assert.equal(
      handlers.some((handler) => handler.command.includes('worktree-guard.mjs')),
      true,
    )
  }
})
