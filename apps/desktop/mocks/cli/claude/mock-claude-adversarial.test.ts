import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readClaudeHarnessInfo } from '@/harnesses/claude/catalog'
import { SESSION_MOCK_ADVERSARIAL_SEED_ENV } from '@/harnesses/proof-protocol'
import { writeMockClaude } from './mock-claude-cli.ts'
import { claudeProjectFolder } from './mock-claude-transcripts.ts'

const ESCAPE = String.fromCharCode(27)

type Prepared = { environment?: NodeJS.ProcessEnv; pluginRoot?: string }

test('the Claude mock exposes models and modes through the SDK catalog reader', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-catalog-'))
  try {
    const transcripts = path.join(root, 'transcripts')
    const executablePath = await writeMockClaude(root, transcripts)
    const info = await readClaudeHarnessInfo(executablePath)
    assert.equal(info.availability, 'available')
    if (info.availability !== 'available') return

    assert.deepEqual(
      info.models.map(({ value, efforts }) => ({ value, efforts })),
      [
        { value: 'fable', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
        { value: 'opus', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
        { value: 'sonnet', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
        { value: 'haiku', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
      ],
    )
    assert.deepEqual(
      info.modes.map(({ value }) => value),
      ['acceptEdits', 'auto', 'bypassPermissions', 'manual', 'dontAsk', 'plan'],
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

async function started(seed: string, prepare?: (root: string) => Promise<Prepared>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-adversarial-claude-'))
  const transcripts = path.join(root, 'transcripts')
  const executable = await writeMockClaude(root, transcripts)
  const prepared = await prepare?.(root)
  const child = spawn(
    executable,
    [
      '--session-id',
      'adversarial-session',
      ...(prepared?.pluginRoot === undefined ? [] : ['--plugin-dir', prepared.pluginRoot]),
    ],
    {
      env: { ...process.env, [SESSION_MOCK_ADVERSARIAL_SEED_ENV]: seed, ...prepared?.environment },
    },
  )
  child.stdin.setDefaultEncoding('utf8')
  await once(child.stdout, 'data')
  return {
    child,
    root,
    transcript: path.join(
      claudeProjectFolder(transcripts, process.cwd()),
      'adversarial-session.jsonl',
    ),
  }
}

function send(child: ReturnType<typeof spawn>, prompt: string) {
  child.stdin.write(`${ESCAPE}[200~${prompt}${ESCAPE}[201~\r`)
}

async function waitFor(read: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await read()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail('condition did not become true')
}

test('a seeded Claude reply survives a split through a multi-byte character', async () => {
  const run = await started('alpha')
  try {
    send(run.child, 'Keep this complete.')
    await new Promise((resolve) => setTimeout(resolve, 150))
    const transcript = await readFile(run.transcript, 'utf8')
    assert.match(transcript, /Mock Claude read: Keep this complete\. 🦜/)
  } finally {
    run.child.kill()
    await once(run.child, 'exit')
    await rm(run.root, { recursive: true, force: true })
  }
})

test('a seeded Claude failure exits during the Turn', async () => {
  const run = await started('seed-0')
  try {
    send(run.child, 'Fail this Turn.')
    const [code] = await once(run.child, 'exit')
    assert.equal(code, 1)
  } finally {
    run.child.kill()
    await rm(run.root, { recursive: true, force: true })
  }
})

test('a seeded Claude stall leaves the Turn open', async () => {
  const run = await started('seed-6')
  try {
    send(run.child, 'Stall this Turn.')
    await new Promise((resolve) => setTimeout(resolve, 150))
    assert.equal(run.child.exitCode, null)
    const transcript = await readFile(run.transcript, 'utf8')
    assert.doesNotMatch(transcript, /Mock Claude read:/)
  } finally {
    run.child.kill()
    await once(run.child, 'exit')
    await rm(run.root, { recursive: true, force: true })
  }
})

function isRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test('a seeded Permission holds while the mock accepts a second queued Turn', async () => {
  let capture = ''
  let hookPidFile = ''
  const run = await started('seed-0', async (root) => {
    const pluginRoot = path.join(root, 'plugin')
    capture = path.join(root, 'permission.json')
    hookPidFile = path.join(root, 'hook.pid')
    await mkdir(pluginRoot)
    const hook = path.join(pluginRoot, 'permission-hook.sh')
    // Holds until the mock or this test process exits, so no outcome leaves it running (#3057).
    await writeFile(
      hook,
      `#!/bin/sh\necho $$ > "${hookPidFile}"\ncat > "${capture}"\nwhile kill -0 $PPID 2>/dev/null && kill -0 ${process.pid} 2>/dev/null; do sleep 0.01; done\n`,
    )
    await chmod(hook, 0o700)
    return { pluginRoot }
  })
  let hookPid = 0
  try {
    send(run.child, 'First Turn waits on Permission.')
    await waitFor(async () => (await readFile(capture, 'utf8').catch(() => '')).length > 0)
    hookPid = Number(await readFile(hookPidFile, 'utf8'))
    send(run.child, 'Second Turn waits behind it.')
    await waitFor(async () => {
      const transcript = await readFile(run.transcript, 'utf8').catch(() => '')
      return (transcript.match(/"type":"user"/g) ?? []).length === 2
    })
    assert.match(await readFile(capture, 'utf8'), /"tool_name":"Bash"/)
  } finally {
    run.child.kill()
    await once(run.child, 'exit')
    await rm(run.root, { recursive: true, force: true })
  }
  await waitFor(async () => !isRunning(hookPid))
})
