import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

type TranscriptLine = {
  root: string
  sessionId: string
  text: string
  updatedAt: string
  cwd?: string
}

function codexDay(root: string) {
  return path.join(root, '2026', '09', '13')
}

function codexMessage(text: string, updatedAt: string, id = 'm') {
  return `${JSON.stringify({
    timestamp: updatedAt,
    type: 'event_msg',
    payload: {
      type: 'agent_message',
      item: { type: 'AgentMessage', id, content: [{ type: 'text', text }] },
    },
  })}\n`
}

export async function writeCodexTranscript(line: TranscriptLine) {
  const { root, sessionId, text, updatedAt, cwd } = line
  const day = codexDay(root)
  await mkdir(day, { recursive: true })
  await writeFile(
    path.join(day, `${sessionId}.jsonl`),
    `${JSON.stringify({
      timestamp: updatedAt,
      type: 'session_meta',
      payload: { id: sessionId, cwd },
    })}\n${codexMessage(text, updatedAt)}`,
  )
}

let appended = 0

function codexRecord({ root, sessionId, text, updatedAt }: TranscriptLine) {
  appended += 1
  return {
    file: path.join(codexDay(root), `${sessionId}.jsonl`),
    record: codexMessage(text, updatedAt, `m-${appended}`),
  }
}

export async function appendCodexTranscript(line: TranscriptLine) {
  const { file, record } = codexRecord(line)
  await appendFile(file, record)
}

export async function appendCodexRecord(
  { root, sessionId }: Pick<TranscriptLine, 'root' | 'sessionId'>,
  record: Record<string, unknown>,
) {
  const file = path.join(codexDay(root), `${sessionId}.jsonl`)
  await appendFile(file, `${JSON.stringify(record)}\n`)
  return file
}

export async function appendHalfCodexTranscript(line: TranscriptLine) {
  const { file, record } = codexRecord(line)
  const cut = Math.floor(record.length / 2)
  await appendFile(file, record.slice(0, cut))
  return () => appendFile(file, record.slice(cut))
}

export async function appendGarbledCodexLine({
  root,
  sessionId,
}: Pick<TranscriptLine, 'root' | 'sessionId'>) {
  await appendFile(path.join(codexDay(root), `${sessionId}.jsonl`), '{"type": garbled\n')
}
