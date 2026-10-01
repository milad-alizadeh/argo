import assert from 'node:assert/strict'
import { appendFileSync, renameSync, truncateSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { AppendedTail } from './appended-tail'

async function transcript(context: TestContext, content: string) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-appended-tail-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  const file = path.join(folder, 'session.jsonl')
  writeFileSync(file, content)
  return file
}

test('a marked file reads nothing of what it held, then only what was appended', async (context) => {
  const file = await transcript(context, 'old\nhistory\n')
  const tail = new AppendedTail()
  await tail.mark(file)
  assert.equal(await tail.read(file), null)
  appendFileSync(file, 'third\n')
  assert.deepEqual(await tail.read(file), { lines: ['third'], continued: true })
  assert.equal(await tail.read(file), null)
})

test('a file marked inside a line skips the rest of that line', async (context) => {
  const file = await transcript(context, 'old\n{"half":')
  const tail = new AppendedTail()
  await tail.mark(file)
  appendFileSync(file, 'true}\nnext\n')
  assert.deepEqual(await tail.read(file), { lines: ['next'], continued: true })
})

test('a file never marked reads from its window’s first whole line', async (context) => {
  const file = await transcript(context, `${'x'.repeat(40)}\nfirst\nsecond\n`)
  const tail = new AppendedTail(20)
  assert.deepEqual(await tail.read(file), { lines: ['first', 'second'], continued: false })
})

test('a partial last line waits for its line break', async (context) => {
  const file = await transcript(context, 'one\n')
  const tail = new AppendedTail()
  await tail.mark(file)
  appendFileSync(file, '{"half":')
  assert.deepEqual(await tail.read(file), { lines: [], continued: true })
  appendFileSync(file, 'true}\n')
  assert.deepEqual(await tail.read(file), { lines: ['{"half":true}'], continued: true })
})

test('a truncated file reads again from its window', async (context) => {
  const file = await transcript(context, 'one\ntwo\n')
  const tail = new AppendedTail()
  await tail.mark(file)
  truncateSync(file, 0)
  appendFileSync(file, 'fresh\n')
  assert.deepEqual(await tail.read(file), { lines: ['fresh'], continued: false })
})

test('a file rewritten in place or replaced reads again from its window', async (context) => {
  const file = await transcript(context, 'one\ntwo\n')
  const tail = new AppendedTail()
  await tail.mark(file)
  writeFileSync(file, 'uno\ndos\ntres\n')
  assert.deepEqual(await tail.read(file), { lines: ['uno', 'dos', 'tres'], continued: false })
  const replacement = `${file}.next`
  writeFileSync(replacement, 'uno\ndos\ntres\ncuatro\n')
  renameSync(replacement, file)
  assert.deepEqual(await tail.read(file), {
    lines: ['uno', 'dos', 'tres', 'cuatro'],
    continued: false,
  })
})

test('an append larger than the window reads only the window’s whole lines', async (context) => {
  const file = await transcript(context, 'one\n')
  const tail = new AppendedTail(32)
  await tail.mark(file)
  appendFileSync(file, `${'y'.repeat(100)}\nnear\nnewest\n`)
  assert.deepEqual(await tail.read(file), { lines: ['near', 'newest'], continued: false })
})

test('a line longer than the window is skipped whole, and the next line reads', async (context) => {
  const file = await transcript(context, '')
  const tail = new AppendedTail(16)
  await tail.mark(file)
  appendFileSync(file, 'z'.repeat(64))
  assert.deepEqual(await tail.read(file), { lines: [], continued: false })
  appendFileSync(file, `${'z'.repeat(8)}\nafter\n`)
  assert.deepEqual(await tail.read(file), { lines: ['after'], continued: true })
})

test('a missing file reads nothing', async (context) => {
  const file = await transcript(context, 'one\n')
  assert.equal(await new AppendedTail().read(`${file}.missing`), null)
})
