// Recorded Claude histories of a chosen size: each Turn is a prompt, a Bash call with output, and a
// long reply, with a diagram in every tenth, so every size carries the same mix of rows.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

function line(record: Record<string, unknown>): string {
  return `${JSON.stringify(record)}\n`
}

const LOREM =
  'Reviewed the call site, weighed the alternative shape, and kept the one that names the ' +
  'behaviour rather than the mechanism. '

// A diagram draws after its row mounts, so it grows a row the Feed has already measured.
const DIAGRAM_EVERY = 10

function longProse(index: number): string {
  const prose = `Turn ${index}: ${LOREM.repeat(24)}`
  if (index % DIAGRAM_EVERY !== 0) return prose
  const diagram = `flowchart TD\n  Prompt${index} --> Read --> Edit --> Test\n  Test --> Reply${index}`
  return `${prose}\n\n\`\`\`mermaid\n${diagram}\n\`\`\``
}

function toolOutput(index: number): string {
  return `$ bun test composer --grep "turn ${index}"\n${'ok 1 - renders the composer\n'.repeat(40)}`
}

type QuadContext = { cwd: string; timestamp: string; parentUuid: string | null; index: number }

function userPromptLine({ cwd, timestamp, parentUuid, index }: QuadContext, uuid: string) {
  return line({
    type: 'user',
    cwd,
    timestamp,
    uuid,
    parentUuid,
    message: { role: 'user', content: `Run the composer tests for turn ${index}.` },
  })
}

function toolCallLine({ cwd, timestamp, index }: QuadContext, uuid: string, parentUuid: string) {
  return line({
    type: 'assistant',
    cwd,
    timestamp,
    uuid,
    parentUuid,
    message: {
      role: 'assistant',
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: `tool-${index}`,
          name: 'Bash',
          input: { command: `bun test composer --grep "turn ${index}"` },
        },
      ],
    },
  })
}

function toolResultLine({ cwd, timestamp, index }: QuadContext, uuid: string, parentUuid: string) {
  return line({
    type: 'user',
    cwd,
    timestamp,
    uuid,
    parentUuid,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: `tool-${index}`, content: toolOutput(index) }],
    },
  })
}

function prosedLine({ cwd, timestamp, index }: QuadContext, uuid: string, parentUuid: string) {
  return line({
    type: 'assistant',
    cwd,
    timestamp,
    uuid,
    parentUuid,
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: `Weighing turn ${index} before answering.` },
        { type: 'text', text: longProse(index) },
      ],
    },
  })
}

function turnQuad(cwd: string, index: number, parentUuid: string | null) {
  const base = `hist-${index}`
  const userUuid = `${base}-u`
  const toolUuid = `${base}-tool`
  const resultUuid = `${base}-result`
  const proseUuid = `${base}-prose`
  const context: QuadContext = {
    cwd,
    timestamp: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
    parentUuid,
    index,
  }
  const lines = [
    userPromptLine(context, userUuid),
    toolCallLine(context, toolUuid, userUuid),
    toolResultLine(context, resultUuid, toolUuid),
    prosedLine(context, proseUuid, resultUuid),
  ]
  return { lines, lastUuid: proseUuid }
}

export type FeedHistory = ReturnType<typeof buildHistory>

export function buildHistory(cwd: string, targetBytes: number, firstIndex = 0) {
  const lines: string[] = []
  let bytes = 0
  let parent: string | null = null
  let lastUuid = ''
  let index = firstIndex
  while (bytes < targetBytes) {
    index += 1
    const quad = turnQuad(cwd, index, parent)
    for (const written of quad.lines) bytes += Buffer.byteLength(written, 'utf8')
    lines.push(...quad.lines)
    parent = quad.lastUuid
    lastUuid = quad.lastUuid
  }
  return { text: lines.join(''), lastUuid, bytes, turns: index - firstIndex }
}

export type AppendedTurn = ReturnType<typeof refreshTurn>

export function refreshTurn(cwd: string, parentUuid: string) {
  const refreshUuid = `${parentUuid}-refresh`
  return {
    text: line({
      type: 'assistant',
      cwd,
      timestamp: new Date().toISOString(),
      uuid: refreshUuid,
      parentUuid,
      message: {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'A turn appended while the reader was looking.' }],
      },
    }),
    refreshUuid,
    cwd,
  }
}

export async function writeHistory(file: string, text: string) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, text)
}

// The SDK reads a Session's history from the folder its cwd encodes to, not from where discovery found it.
export function historyPath(transcripts: string, cwd: string, sessionId: string) {
  return path.join(transcripts, cwd.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionId}.jsonl`)
}
