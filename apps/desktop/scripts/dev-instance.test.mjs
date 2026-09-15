import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import { developmentInstance, portCollisionError } from './dev-instance.mjs'

const worktree = path.join(path.sep, 'worktrees', 'ticket-2173')

describe('desktop development instances', () => {
  test('derives stable, isolated metadata from the worktree', () => {
    const first = developmentInstance(worktree)
    const second = developmentInstance(worktree)

    expect(first).toEqual(second)
    expect(first.directory).toContain('argo-desktop-dev')
    expect(first.directory).toStartWith('/tmp/argo-desktop-dev')
    expect(first.title).toContain('ticket-2173')
    expect(first.title).toContain(`:${first.port}`)
    expect(first.userData).toBe(path.join(first.directory, 'user-data'))
  })

  test('uses an explicit development port when an agent resolves a collision', () => {
    expect(developmentInstance(worktree, '45173').port).toBe(45173)
  })

  test('reports a port collision before Forge starts', () => {
    expect(() => portCollisionError(45173, 'ticket-2173')).toThrow(
      'Port 45173 for ticket-2173 is already in use.',
    )
  })
})
