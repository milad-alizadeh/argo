import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { claudeSessionMessages } from '../../../e2e/sessions/real-harness/claude-vendor-reader.ts'
import { writeMockClaude } from './mock-claude-cli.ts'
import { claudeProjectFolder } from './mock-claude-transcripts.ts'

const ESCAPE = String.fromCharCode(27)
const SESSION_ID = '00000000-0000-4000-8000-00000000be01'

function earlierRecord(type: 'user' | 'assistant', uuid: string, parentUuid: string | null) {
  const text = `earlier ${uuid}`
  const message =
    type === 'user'
      ? { role: 'user', content: text }
      : { role: 'assistant', content: [{ type: 'text', text }] }
  return JSON.stringify({ type, sessionId: SESSION_ID, uuid, parentUuid, message })
}

test('a resumed mock Claude chains its first new record to the newest earlier one', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-resume-'))
  const configDirectory = path.join(root, 'claude-config')
  const transcripts = path.join(configDirectory, 'projects')
  try {
    const executable = await writeMockClaude(root, transcripts)
    const folder = claudeProjectFolder(transcripts, process.cwd())
    await mkdir(folder, { recursive: true })
    await writeFile(
      path.join(folder, `${SESSION_ID}.jsonl`),
      [
        earlierRecord('user', 'earlier-1', null),
        earlierRecord('assistant', 'earlier-2', 'earlier-1'),
        JSON.stringify({ type: 'custom-title', customTitle: 'Titled' }),
      ].join('\n') + '\n',
    )
    const child = spawn(executable, ['--resume', SESSION_ID], { env: process.env })
    try {
      await once(child.stdout, 'data')
      child.stdin.write(`${ESCAPE}[200~Go on please${ESCAPE}[201~\r`)
      const deadline = Date.now() + 5_000
      let texts: string[] = []
      while (Date.now() < deadline && !texts.some((text) => text.includes('Mock Claude read'))) {
        await new Promise((resolve) => setTimeout(resolve, 10))
        const messages = await claudeSessionMessages(configDirectory, SESSION_ID).catch(() => [])
        texts = messages.map((message) => JSON.stringify(message.message))
      }
      assert.deepEqual(
        texts.map(
          (text) => /earlier-\d|Mock Claude read: Go on please|Go on please/.exec(text)?.[0],
        ),
        ['earlier-1', 'earlier-2', 'Go on please', 'Mock Claude read: Go on please'],
      )
    } finally {
      child.kill()
      await once(child, 'exit')
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
