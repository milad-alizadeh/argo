import { describe, expect, test } from 'bun:test'
import { createServer } from 'node:net'
import path from 'node:path'
import { assertPortAvailable, developmentInstance, portCollisionError } from './dev-instance.mjs'

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

  test('rejects an occupied development port', async () => {
    const server = createServer()
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server has no TCP port.')

    try {
      await expect(assertPortAvailable(address.port, 'ticket-2173')).rejects.toThrow(
        `Port ${address.port} for ticket-2173 is already in use.`,
      )
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
})
