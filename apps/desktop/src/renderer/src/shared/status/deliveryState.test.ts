import { type CiStatus, type SessionFactsInput, type SessionPosture, sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import { deliveryState } from './deliveryState'
import type { RosterWord, SessionDot } from './railVocabulary'

// `deliveryState` is the ONE derivation entry point, and this is the contract that makes it worth
// being one: the dot it hands out follows THE WORD THE RAIL PICKED, never the session status
// underneath it. A row reading `CI failed` beside a green running dot breaks the registry's
// one-telling rule inside a single row.

const HEAD = 'a1b2c3d'
const OLD = '9f0e1d2'
const PR = { num: 42, state: 'open', base: 'main' } as const
const REVIEWING = [{ by: '@sam', verdict: 'running', sha: HEAD, findings: 0 }] as const

const checked = (status: CiStatus, sha: string = HEAD): SessionFactsInput => ({
  headSha: HEAD,
  pr: PR,
  ci: { status, sha },
})

// The whole dot in one readable line, so a case can state every channel it expects at once: the
// defect worth catching is a state that took the right tone and another state's motion.
const dotReads = (dot: SessionDot): string =>
  [
    dot.tone,
    dot.glow,
    dot.pulse ? 'breathing' : 'still',
    dot.attention ? 'sweeping' : 'no-sweep',
    dot.hollow ? 'hollow' : 'filled',
  ].join(' ')

const rails: [RosterWord, string, SessionFactsInput, SessionPosture][] = [
  ['running', 'run live breathing no-sweep filled', {}, 'managed'],
  ['idle', 'gray quiet still no-sweep filled', { status: 'idle' }, 'managed'],
  ['needs you', 'amber live breathing sweeping filled', { status: 'permission' }, 'managed'],
  ['needs you', 'amber live breathing sweeping filled', { status: 'asking' }, 'managed'],
  ['failed', 'red live still no-sweep filled', { status: 'stopped' }, 'managed'],
  ['failed', 'red live still no-sweep filled', { status: 'ended' }, 'managed'],
  ['read-only', 'gray faint still no-sweep hollow', {}, 'external'],
  ['read-only', 'gray faint still no-sweep hollow', {}, 'orphaned'],
  ['CI failed', 'red live still no-sweep filled', checked('failed'), 'managed'],
  ['blocked', 'amber live breathing sweeping filled', checked('passed', OLD), 'managed'],
  ['CI running', 'run live breathing no-sweep filled', checked('running'), 'managed'],
  [
    'PR #42',
    'run live breathing no-sweep filled',
    { ...checked('passed'), review: [...REVIEWING] },
    'managed',
  ],
  [
    'landed',
    'landed quiet still no-sweep filled',
    { headSha: HEAD, pr: { num: 38, state: 'merged', base: 'main' } },
    'managed',
  ],
]

describe('the dot a row draws', () => {
  for (const [word, reads, input, posture] of rails) {
    it(`draws "${word}" ${reads}`, () => {
      const { rail } = deliveryState(sessionFacts(input), posture)
      expect([rail.word, dotReads(rail.dot)]).toEqual([word, reads])
    })
  }
})
