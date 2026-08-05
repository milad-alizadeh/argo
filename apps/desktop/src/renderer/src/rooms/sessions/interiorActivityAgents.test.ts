import type { Agent, Turn } from '@shared'
import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import {
  aSubagent as agent,
  aRoot,
  aToolCall as call,
  aTurn as turn,
} from './__fixtures__/runtimeTree'
import { anchorKeys, buildActivity } from './interiorActivity'

// Which agent the pane holds, and the parity the two panes are held to. Split from
// `interiorActivity.test.ts`, which judges one agent's own turns.

const rootWith = (turns: Turn[], compactions: Agent['compactions'] = []): Agent =>
  aRoot({ turns, compactions })

// The pane holds ONE agent (issue 319). A feed that concatenated a delegate's work with the session's
// own read as one timeline that never happened.
describe('the agent the pane displays', () => {
  const session = sessionView({
    id: 's',
    agents: [
      rootWith([turn({ id: 'own' })]),
      agent({
        id: 'a',
        label: 'lens',
        group: 'Verify',
        turns: [turn({ id: 'sub', stopReason: null })],
      }),
    ],
  })

  it('opens on the root Agent, and mounts no other agent’s rows', () => {
    const activity = buildActivity(session)
    expect(activity.agent.id).toBe('root')
    expect(activity.sections.map(({ key }) => key)).toEqual(['turn:own'])
    expect(activity.agent.head).toBeNull()
    expect(activity.agent.parent).toBeNull()
  })

  it('replaces the feed with a selected subagent’s own turns, and names the way back', () => {
    const activity = buildActivity(session, { agentId: 'a' })
    expect(activity.sections.map(({ key }) => key)).toEqual(['turn:sub'])
    expect(activity.agent.head?.name).toBe('lens')
    expect(activity.agent.head?.meta).toContain('Verify')
    expect(activity.agent.parent).toEqual({ id: 'root', label: 'the session' })
  })

  // A running subagent's feed follows its OWN live edge: `live` is the displayed agent's fact, never
  // the session's.
  it('reports liveness per displayed agent', () => {
    expect(buildActivity(session).agent.live).toBe(false)
    expect(buildActivity(session, { agentId: 'a' }).agent.live).toBe(true)
  })

  it('lists the DISPLAYED agent’s delegates, so a nested fanout is not hoisted to its grandparent', () => {
    const nested = sessionView({
      id: 's',
      agents: [
        rootWith([]),
        agent({ id: 'a', label: 'lens' }),
        agent({ id: 'a1', parentId: 'a', label: 'deeper' }),
      ],
    })
    expect(buildActivity(nested).subagents?.rows.map(({ agentId }) => agentId)).toEqual(['a'])
    expect(
      buildActivity(nested, { agentId: 'a' }).subagents?.rows.map(({ agentId }) => agentId),
    ).toEqual(['a1'])
  })

  it('falls back to the root when the selected agent is gone, rather than emptying the pane', () => {
    expect(buildActivity(session, { agentId: 'vanished' }).agent.id).toBe('root')
  })
})

describe('the feed the sections carry', () => {
  it('carries each turn its own prose rows, and no head above them', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([
          turn({
            id: 't',
            prose: [
              { kind: 'thought', markdown: 'weigh it' },
              { kind: 'message', markdown: 'wired' },
            ],
          }),
        ]),
      ],
    })
    expect(buildActivity(session).sections[0]?.rows.map(({ kind }) => kind)).toEqual([
      'thought',
      'message',
    ])
  })

  // The head is gone: the prompt row IS the seam between exchanges, so the section keeps the row
  // rather than dropping it to a heading that clipped the same sentence an inch above.
  it('opens a turn section with the prompt that caused it, however short', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 't', prompt: 'ship it' })])],
    })
    expect(buildActivity(session).sections[0]?.rows.map(({ kind }) => kind)).toEqual(['prompt'])
  })

  it('reads a subagent’s feed with the same row vocabulary as the root’s', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([]),
        agent({
          id: 'a',
          label: 'lens',
          turns: [
            turn({
              id: 't',
              prompt: 'grep it',
              toolCalls: [call({ id: 'c', kind: 'execute', name: 'Bash', target: 'rg foo' })],
            }),
          ],
        }),
      ],
    })
    expect(
      buildActivity(session, { agentId: 'a' }).sections[0]?.rows.map(({ kind }) => kind),
    ).toEqual(['prompt', 'call'])
  })
})

// The parity the two panes are held to. Both are drawn from `sections`, so this is arithmetic rather
// than a comparison of two components.
describe('pane parity', () => {
  const session = sessionView({
    id: 's',
    agents: [
      rootWith([
        turn({
          id: 't',
          prose: [{ kind: 'message', markdown: 'done' }],
          toolCalls: [
            call({ id: 'r1' }),
            call({ id: 'r2' }),
            call({ id: 'r3', kind: 'search', name: 'Grep' }),
            call({ id: 'e', kind: 'execute', name: 'Bash', target: 'bun test' }),
          ],
        }),
      ]),
    ],
  })

  it('gives a folded run exactly one nav entry and one anchor', () => {
    const [section] = buildActivity(session).sections
    // Three consecutive observations fold to ONE row, and the command that broke the run gets its own.
    expect(section?.turn.steps.map(({ key, name }) => [key, name])).toEqual([
      ['quiet:r1', 'read 2 · searched 1'],
      ['call:e', 'Bash'],
    ])
  })

  it('anchors every nav entry on a row the feed actually draws', () => {
    const { sections } = buildActivity(session)
    const drawn = new Set(sections.flatMap(({ key, rows }) => [key, ...rows.map((row) => row.key)]))
    expect(anchorKeys(sections).every((key) => drawn.has(key))).toBe(true)
  })

  it('lists the anchors in the order the feed reads them', () => {
    const { sections } = buildActivity(session)
    expect(anchorKeys(sections)).toEqual(['turn:t', 'quiet:r1', 'call:e'])
  })
})
