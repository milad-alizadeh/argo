import assert from 'node:assert/strict'
import { test } from 'node:test'
import { counted, noteOnReading } from '../sessions/reading-note.ts'

test('says only what it read when it reached every file', () => {
  assert.equal(
    noteOnReading({ filesFound: 8, filesRead: 8, filesUnreadable: 0 }),
    'Read 8 transcript files.',
  )
})

// The number under the word "Read" is the number of files that were read. Counting the ones that
// could not be opened towards it states a file was read that was not.
test('leaves a file it could not open out of the read count', () => {
  assert.equal(
    noteOnReading({ filesFound: 8, filesRead: 6, filesUnreadable: 2 }),
    'Read 6 transcript files. 2 files could not be opened.',
  )
})

test('says the cap fired without calling it damage', () => {
  assert.equal(
    noteOnReading({ filesFound: 1055, filesRead: 200, filesUnreadable: 0 }),
    'Read 200 transcript files. Argo reached the 200 most recent of 1055.',
  )
})

// A cap and damage are two facts at once, and neither is allowed to stand in for the other.
test('counts a cap and damage apart', () => {
  assert.equal(
    noteOnReading({ filesFound: 1055, filesRead: 198, filesUnreadable: 2 }),
    'Read 198 transcript files. Argo reached the 200 most recent of 1055. 2 files could not be opened.',
  )
})

test('counts one of a thing as one', () => {
  assert.equal(counted(1, 'unreadable line'), '1 unreadable line')
  assert.equal(counted(0, 'unreadable line'), '0 unreadable lines')
})
