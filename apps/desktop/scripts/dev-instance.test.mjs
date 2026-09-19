import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { createConnection, createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { developmentSetupDocumentEnvironment } from '../src/domains/projects/main/setup/setup-document-source.mjs'
import { stopDevelopmentInstance } from './dev-control.mjs'
import {
  assertPortAvailable,
  developmentBuildLabel,
  developmentInstance,
  portCollisionError,
  startControlServer,
} from './dev-instance.mjs'

const worktree = path.join(path.sep, 'worktrees', 'ticket-2173')

describe('desktop development instances', () => {
  test('derives stable, isolated metadata from the worktree', () => {
    const first = developmentInstance(worktree)
    const second = developmentInstance(worktree)

    expect(first).toEqual(second)
    expect(first.directory).toContain('argo-desktop-dev')
    expect(first.directory).toStartWith('/tmp/argo-desktop-dev')
    expect(first.title).toContain('#2173')
    expect(first.title).toContain(`:${first.port}`)
    expect(first.userData).toBe(path.join(first.directory, 'user-data'))
  })

  test('uses only the ticket number as the development build label', () => {
    expect(developmentBuildLabel('/worktrees/argo', 'argo/#2173-isolate-launches')).toBe('#2173')
    expect(
      developmentInstance('/worktrees/argo', '45173', 'argo/#2173-isolate-launches'),
    ).toMatchObject({
      label: '#2173',
      title: 'Argo dev · #2173 · :45173',
    })
  })

  test('loads Project setup from the current GitHub branch', () => {
    expect(developmentSetupDocumentEnvironment('argo/#2173-isolate-launches')).toEqual({
      ARGO_SETUP_DOCUMENT_DEVELOPMENT_URL:
        'https://raw.githubusercontent.com/milad-alizadeh/argo/argo/%232173-isolate-launches/packages/argo-skills/setup/project-setup.json',
    })
  })

  test('falls back to a readable numberless branch label', () => {
    expect(developmentBuildLabel('/worktrees/argo', 'argo/build-identity-bar')).toBe(
      'build-identity-bar',
    )
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
    await new Promise((resolve) => server.listen(0, '::1', resolve))
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

function request(controlFile, command) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(controlFile)
    socket.once('error', reject)
    socket.once('connect', () => socket.write(command))
    socket.once('data', (reply) => {
      resolve(reply.toString())
      socket.end()
    })
  })
}

test('stops only the Electron process that the live launcher registered', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-desktop-dev-'))
  const controlFile = path.join(directory, 'control.sock')
  let stopped = false
  const server = await startControlServer(controlFile, 'proof-token', () => {
    stopped = true
  })

  try {
    expect(await request(controlFile, 'stop 43 proof-token')).toBe('invalid command')
    expect(stopped).toBe(false)
    expect(await request(controlFile, 'ready 43 proof-token')).toBe('ready')
    expect(await request(controlFile, 'stop 43 wrong-token')).toBe('invalid command')
    await stopDevelopmentInstance(controlFile, 43, 'proof-token')
    expect(stopped).toBe(true)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    await rm(directory, { recursive: true, force: true })
  }
})
