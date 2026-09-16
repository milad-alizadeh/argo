// A minimal fake CLI transcript reader, shared by every test proving the discovery engine
// (#2239, #2290) rather than either real adapter: the bound window, its cursor, and chain
// resolution belong to this module regardless of which CLI's files it is reading.
import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createTranscriptDiscoverer } from './discover-transcript-sessions'
import type { TranscriptRecord } from './transcript'

export type FakeTranscript = {
  root: string
  sessionId: string
  writtenAt: string
  // The Session this one resumes, and the title record it carries, for proving chain resolution
  // and title stability across the read window's boundary (#2290).
  origin?: string
  title?: { text: string; source: 'custom' | 'summarised' }
}

// A fake CLI's transcript: one message line, so a fixture tree of many Sessions is cheap to
// build. `writtenAt` sets the file's mtime directly, the field the engine's window sorts on, so
// a test can name recency without racing the filesystem clock across many fast writes.
export async function writeFakeTranscript({
  root,
  sessionId,
  writtenAt,
  origin,
  title,
}: FakeTranscript) {
  const file = path.join(root, `${sessionId}.jsonl`)
  const lines = [
    ...(title === undefined
      ? []
      : [JSON.stringify({ kind: 'title', title: title.text, source: title.source })]),
    JSON.stringify({ uuid: sessionId, timestamp: writtenAt, originSessionId: origin }),
  ]
  await writeFile(file, `${lines.join('\n')}\n`)
  const at = new Date(writtenAt)
  await utimes(file, at, at)
}

function parseFakeLine(line: string): TranscriptRecord | null {
  if (line.trim() === '') return null
  const parsed = JSON.parse(line) as {
    kind?: string
    title?: string
    source?: 'custom' | 'summarised'
    uuid?: string
    timestamp?: string
    originSessionId?: string
  }
  if (parsed.kind === 'title') {
    return { kind: 'title', title: parsed.title ?? '', source: parsed.source ?? 'custom' }
  }
  const { uuid = '', timestamp = '', originSessionId = null } = parsed
  return {
    kind: 'message',
    uuid,
    parentUuid: null,
    originSessionId,
    role: 'assistant',
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp,
    entry: 'interactive',
    stopReason: 'end_turn',
    model: null,
    effort: null,
    mode: null,
    blocks: [{ shape: 'prose', text: 'Hi.' }],
    toolCalls: [],
    answeredCalls: [],
    usage: null,
  }
}

export function fakeDiscoverer() {
  return createTranscriptDiscoverer({
    cli: 'fake',
    parse: parseFakeLine,
    transcriptPaths: async (root) => {
      const names = await readdir(root).catch(() => [])
      return names
        .filter((name) => name.endsWith('.jsonl'))
        .map((name) => ({ path: path.join(root, name), name }))
    },
  })
}

export async function fakeRoot(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-discover-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return root
}

// Sessions named so the Nth-newest one is `s<N>`, most recent first, spaced a minute apart so
// their mtimes never tie.
export async function writeManySessions(root: string, count: number) {
  const base = Date.parse('2026-09-13T12:00:00.000Z')
  for (let index = 0; index < count; index += 1) {
    const writtenAt = new Date(base - index * 60_000).toISOString()
    await writeFakeTranscript({ root, sessionId: `s${index}`, writtenAt })
  }
}
