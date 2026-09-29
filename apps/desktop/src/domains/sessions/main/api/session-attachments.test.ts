import { afterEach, describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { initTRPC } from '@trpc/server'
import { sessionAttachmentProcedures, statAttachmentPaths } from './session-attachments'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

describe('session attachment stat', () => {
  test('a path Argo can read is readable and a missing path is not', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'argo-attachments-'))
    directories.push(directory)
    const present = path.join(directory, 'note.txt')
    await writeFile(present, 'hello')
    const missing = path.join(directory, 'gone.txt')
    assert.deepEqual(await statAttachmentPaths([present, missing]), {
      files: [
        { path: present, readable: true },
        { path: missing, readable: false },
      ],
    })
  })

  test('choosing files returns the paths the dialog handed back', async () => {
    const chosen = ['/tmp/one.txt']
    const caller = initTRPC
      .create()
      .router(sessionAttachmentProcedures({ chooseAttachmentFiles: async () => chosen }))
      .createCaller({})
    expect(await caller.sessionAttachmentChoose()).toEqual({ paths: chosen })
  })
})
