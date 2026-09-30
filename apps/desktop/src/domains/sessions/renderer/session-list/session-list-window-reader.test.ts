import { expect, test } from 'bun:test'
import {
  type SessionListAnchor,
  type SessionListWindowRead,
  SessionListWindowReader,
} from './session-list-window-reader'

type Window = { label: string }

// A read the test settles by hand, so it can land a commit or a seek while the read is in flight.
function controlledReads() {
  const pending: { anchor: SessionListAnchor; settle: (label: string) => void }[] = []
  const read: SessionListWindowRead<Window> = (anchor) =>
    new Promise((resolve) => {
      pending.push({ anchor, settle: (label) => resolve({ label }) })
    })
  const settle = async (label: string) => {
    const next = pending.shift()
    if (next === undefined) throw new Error('No window read is in flight.')
    next.settle(label)
    await Promise.resolve()
    await Promise.resolve()
  }
  return { pending, read, settle }
}

function readerWith(reads: ReturnType<typeof controlledReads>) {
  const published: string[] = []
  const scheduled: (() => void)[] = []
  const reader = new SessionListWindowReader<Window>({
    read: reads.read,
    publish: (window) => published.push(window.label),
    fail: () => published.push('failed'),
    schedule: (run) => scheduled.push(run),
  })
  const runScheduled = () => {
    for (const run of scheduled.splice(0)) run()
  }
  return { published, reader, runScheduled }
}

test('starts no read before the change listener says it is attached', async () => {
  const reads = controlledReads()
  const { published, reader } = readerWith(reads)

  reader.seek({ kind: 'start' })
  const beforeAttach = reads.pending.length
  reader.invalidate()
  await reads.settle('first')

  expect(beforeAttach).toBe(0)
  expect(published).toEqual(['first'])
})

test('reads once more after a commit that lands during a read', async () => {
  const reads = controlledReads()
  const { published, reader, runScheduled } = readerWith(reads)

  reader.invalidate()
  reader.invalidate()
  reader.invalidate()
  const inFlight = reads.pending.length
  await reads.settle('before commit')
  runScheduled()
  await reads.settle('after commit')

  expect(inFlight).toBe(1)
  expect(published).toEqual(['before commit', 'after commit'])
  expect(reads.pending).toHaveLength(0)
})

test('drops a window read for an anchor the reader has since moved from', async () => {
  const reads = controlledReads()
  const { published, reader } = readerWith(reads)
  reader.invalidate()
  await reads.settle('top')

  reader.seek({ kind: 'index', index: 40 })
  reader.seek({ kind: 'index', index: 80 })
  await reads.settle('stale 40')
  const followUp = reads.pending[0]?.anchor
  await reads.settle('current 80')

  expect(followUp).toEqual({ kind: 'index', index: 80 })
  expect(published).toEqual(['top', 'current 80'])
})

test('scrolls down and back up through bounded windows', async () => {
  const reads = controlledReads()
  const { published, reader } = readerWith(reads)
  reader.invalidate()
  await reads.settle('rows 0-89')

  reader.seek({ kind: 'key', listOrderAt: 500, id: '00000000-0000-4000-8000-000000000060' })
  await reads.settle('rows 30-119')
  reader.seek({ kind: 'start' })
  await reads.settle('rows 0-89 again')

  expect(published).toEqual(['rows 0-89', 'rows 30-119', 'rows 0-89 again'])
  expect(reads.pending).toHaveLength(0)
})

test('gathers a burst of changes into one read', async () => {
  const reads = controlledReads()
  const { published, reader, runScheduled } = readerWith(reads)
  reader.invalidate()
  await reads.settle('first')

  for (let change = 0; change < 60; change += 1) reader.invalidate()
  const beforeDelay = reads.pending.length
  runScheduled()
  await reads.settle('after burst')

  expect(beforeDelay).toBe(0)
  expect(published).toEqual(['first', 'after burst'])
  expect(reads.pending).toHaveLength(0)
})

test('publishes nothing after it is disposed', async () => {
  const reads = controlledReads()
  const { published, reader } = readerWith(reads)
  reader.invalidate()
  reader.dispose()
  await reads.settle('late')
  reader.invalidate()

  expect(published).toEqual([])
  expect(reads.pending).toHaveLength(0)
})

test('reports a failed read and reads again on the next change', async () => {
  const published: string[] = []
  let fail = true
  const reader = new SessionListWindowReader<Window>({
    read: async () => {
      if (fail) throw new Error('main is gone')
      return { label: 'recovered' }
    },
    publish: (window) => published.push(window.label),
    fail: () => published.push('failed'),
    schedule: (run) => run(),
  })

  reader.invalidate()
  await new Promise((resolve) => setTimeout(resolve, 0))
  fail = false
  reader.invalidate()
  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(published).toEqual(['failed', 'recovered'])
})
