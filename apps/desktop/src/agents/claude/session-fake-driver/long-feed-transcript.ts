// A long Claude transcript for `bun run profile --packaged` (#2228): enough mixed rows (prose,
// markdown, code, tool calls and their output) that a fast scroll outruns the Feed's overscan.
import { copyFile, mkdir, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const LONG_FEED_SESSION = 'profile-long-feed'
const CWD = '/Users/x/profile'
const PROJECT = 'project-one'

const PROSE = [
  'The reader keeps its position while rows append, so the anchor is the first visible row.',
  '## What changed\n\n- The parser reads one record at a time.\n- The projection keeps row ids.\n- The virtualizer measures each row once.',
  'Here is the relevant part:\n\n```ts\nexport function project(rows: Row[]) {\n  return rows.filter((row) => row.visible).map((row) => ({ ...row, height: measure(row) }))\n}\n```\n\nThe map allocates once per row, which is fine at this size.',
  `A longer paragraph that wraps across several lines in the Feed. ${'It keeps going to fill the width of the column and push the row height past the estimate. '.repeat(4)}`,
]

const id = (index: number, name: string) => `lf-${index}-${name}`

// The four records of one turn, in order: prompt, tool call, tool result, answer.
function messages(index: number) {
  const toolId = id(index, 'bash')
  const output = Array.from({ length: 6 }, (_, line) => `pass step ${index}.${line}`).join('\n')
  return [
    { role: 'user', content: `Step ${index}: look at the next part of the Feed.` },
    {
      role: 'assistant',
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: PROSE[index % PROSE.length] },
        {
          type: 'tool_use',
          id: toolId,
          name: 'Bash',
          input: { command: `bun test step-${index}` },
        },
      ],
    },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolId, content: output }] },
    {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: PROSE[(index + 1) % PROSE.length] }],
    },
  ]
}

const NAMES = ['prompt', 'call', 'result', 'answer']

function turn(index: number, at: (offset: number) => string) {
  return messages(index).map((message, offset) => {
    const previous = offset === 0 ? id(index - 1, 'answer') : id(index, NAMES[offset - 1] ?? '')
    return JSON.stringify({
      cwd: CWD,
      type: message.role,
      uuid: id(index, NAMES[offset] ?? ''),
      parentUuid: index === 0 && offset === 0 ? null : previous,
      timestamp: at(offset),
      message,
    })
  })
}

function transcriptFile(transcripts: string) {
  return path.join(transcripts, PROJECT, `${LONG_FEED_SESSION}.jsonl`)
}

// The newest file heads the Roster, so the mtime is pushed past every other fixture's.
async function markNewest(file: string) {
  const future = new Date(Date.now() + 60_000)
  await utimes(file, future, future)
}

export async function writeLongFeedTranscript(transcripts: string, turns: number) {
  const file = transcriptFile(transcripts)
  await mkdir(path.dirname(file), { recursive: true })
  const start = Date.UTC(2026, 8, 1, 9, 0, 0)
  const lines = Array.from({ length: turns }, (_, index) =>
    turn(index, (offset) => new Date(start + (index * 4 + offset) * 1000).toISOString()),
  ).flat()
  await writeFile(file, `${lines.join('\n')}\n`)
  await markNewest(file)
  return LONG_FEED_SESSION
}

// A real transcript the reader chose, copied in under the same Session id.
export async function copyTranscript(transcripts: string, source: string) {
  const file = transcriptFile(transcripts)
  await mkdir(path.dirname(file), { recursive: true })
  await copyFile(source, file)
  await markNewest(file)
  return LONG_FEED_SESSION
}
