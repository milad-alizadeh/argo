#!/usr/bin/env node
import { access, readFile, realpath } from 'node:fs/promises'
import { createConnection } from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { developmentInstance } from './dev-instance.mjs'

const DESKTOP_ROOT = path.resolve(import.meta.dirname, '..')
const REPOSITORY_ROOT = path.resolve(DESKTOP_ROOT, '..', '..')

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`Ready record has invalid ${name}.`)
  return value
}

function text(value, name) {
  if (typeof value !== 'string' || !value) throw new Error(`Ready record has invalid ${name}.`)
  return value
}

export function parseReadyRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Ready record must be an object.')
  if (value.state !== 'ready') throw new Error('Ready record has invalid state.')
  if (value.version !== 1) throw new Error('Ready record has invalid version.')

  return {
    id: text(value.id, 'id'),
    launcherPid: positiveInteger(value.launcherPid, 'launcherPid'),
    port: positiveInteger(value.port, 'port'),
    processId: positiveInteger(value.processId, 'processId'),
    state: value.state,
    title: text(value.title, 'title'),
    userData: text(value.userData, 'userData'),
    version: value.version,
    worktree: text(value.worktree, 'worktree'),
  }
}

export function stopDevelopmentInstance(controlFile) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(controlFile)
    socket.once('error', () => reject(new Error('The development launcher is not running.')))
    socket.once('connect', () => socket.write('stop'))
    socket.once('data', (reply) => {
      if (reply.toString() === 'stopping') resolve()
      else reject(new Error('The development launcher rejected the stop request.'))
      socket.end()
    })
  })
}

async function readyRecord(worktree) {
  const instance = developmentInstance(worktree)
  try {
    await access(instance.readyFile)
  } catch {
    throw new Error(`No ready development instance exists for ${instance.id}.`)
  }

  const record = parseReadyRecord(JSON.parse(await readFile(instance.readyFile, 'utf8')))
  if (
    record.id !== instance.id ||
    record.worktree !== worktree ||
    record.userData !== instance.userData
  )
    throw new Error(`The ready record for ${instance.id} does not match this worktree.`)
  return { instance, record }
}

async function main() {
  const worktree = await realpath(REPOSITORY_ROOT)
  const { instance, record } = await readyRecord(worktree)
  const command = process.argv[2]

  switch (command) {
    case 'status':
      process.stdout.write(`${JSON.stringify({ ...record, readyFile: instance.readyFile })}\n`)
      return
    case 'stop':
      await stopDevelopmentInstance(instance.controlFile)
      process.stdout.write(`Stopped ${instance.id}.\n`)
      return
    default:
      throw new Error('Usage: node scripts/dev-control.mjs <status|stop>')
  }
}

if (process.argv[1] === import.meta.filename) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
