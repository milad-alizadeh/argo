import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { type TestContext, test } from 'node:test'
import { probeLocks } from './lock-probe'

async function folder(context: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-lock-probe-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

// Another process takes the file's flock and keeps it until the test ends, as a writer does.
async function holdLock(context: TestContext, file: string) {
  const holder = spawn('/usr/bin/perl', [
    '-e',
    'use Fcntl qw(:flock); open(my $h, ">>", $ARGV[0]) or die; flock($h, LOCK_EX) or die; $| = 1; print "locked\\n"; sleep 60',
    file,
  ])
  context.after(() => {
    holder.kill()
  })
  const lines = createInterface({ input: holder.stdout })
  for await (const line of lines) if (line === 'locked') return
  throw new Error('The lock holder exited before it took the lock.')
}

test('a held lock reads held, a free one free, and a missing file missing', async (context) => {
  const directory = await folder(context)
  const held = path.join(directory, 'held.lock')
  const free = path.join(directory, 'free.lock')
  writeFileSync(held, '')
  writeFileSync(free, '')
  await holdLock(context, held)
  const missing = path.join(directory, 'missing.lock')
  const states = await probeLocks([held, free, missing])
  assert.deepEqual(Object.fromEntries(states), {
    [held]: 'held',
    [free]: 'free',
    [missing]: 'missing',
  })
})

test('the probe lets go, so the writer can take the lock after it', async (context) => {
  const file = path.join(await folder(context), 'thread.lock')
  writeFileSync(file, '')
  assert.equal((await probeLocks([file])).get(file), 'free')
  await holdLock(context, file)
  assert.equal((await probeLocks([file])).get(file), 'held')
})

test('more files than one perl run takes are all answered', async (context) => {
  const directory = await folder(context)
  const files = Array.from({ length: 300 }, (_, index) => path.join(directory, `${index}.lock`))
  const states = await probeLocks(files)
  assert.equal(states.size, 300)
  assert.ok([...states.values()].every((state) => state === 'missing'))
})
