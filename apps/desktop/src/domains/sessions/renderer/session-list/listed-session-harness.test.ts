import { describe, expect, test } from 'bun:test'
import { DEFAULT_HARNESS, HARNESSES } from '@/harnesses/harness'
import { listedSessionHarness } from './listed-session-harness'

// The default is the first Harness, so the second shows a row's own Harness won.
const listed = HARNESSES[1]
const page = (rows: { id: string; harness: string }[]) => ({ pages: [{ rows }] })

describe('listedSessionHarness', () => {
  test('a loaded row names its Session Harness', () => {
    const lists = [
      undefined,
      page([{ id: 'other', harness: DEFAULT_HARNESS }]),
      page([{ id: 'opened', harness: listed }]),
    ]
    expect(listedSessionHarness(lists, 'opened')).toBe(listed)
  })

  test('no loaded row, or an unknown Harness, names none', () => {
    expect(listedSessionHarness([page([{ id: 'other', harness: listed }])], 'opened')).toBeNull()
    expect(
      listedSessionHarness([page([{ id: 'opened', harness: 'retired' }])], 'opened'),
    ).toBeNull()
  })
})
