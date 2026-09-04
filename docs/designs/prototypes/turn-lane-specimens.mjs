#!/usr/bin/env node
// PROTOTYPE — #1174. Reads three real Claude Code transcripts and writes the rows and Turns the
// overview lane would be asked to draw, as `turn-lane-specimens.json`.
//
// Throwaway. It is a JS re-statement of `FeedProjection` + `TurnExtents` + `FeedRowMeasure`,
// accurate enough to argue about lane MARKS with. It is not a second model to keep in step:
// nothing in the app reads it, and it dies with the branch.
//
// What is REAL here: every row's existence, kind, order, and words, and every Turn boundary —
// those come off the record and follow the shipped rules.
// What is MODELLED here: every row's HEIGHT. The app measures heights with Core Text
// (`FeedRowMeasure` → `FeedProseFrame`); this wraps at an average advance instead. So a height is
// within a line or two of the truth per row, and the DISTRIBUTION is what the variants are judged
// on rather than any single bar.
//
// Usage: node docs/designs/prototypes/turn-lane-specimens.mjs

import { createReadStream, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import path from 'node:path'
import os from 'node:os'

const PROJECTS = path.join(os.homedir(), '.claude', 'projects')

// The three shapes #1174 names. `dir` is the project folder the session ran in.
const SPECIMENS = [
  {
    key: 'ordinary',
    title: 'Ordinary',
    id: '0ec3b3b6',
    note: '#1173 measured 592 rows / 85 Turns / 7.0 rows per Turn.',
    dir: '-Users-milad-Developer-argo',
    file: '0ec3b3b6-99ce-4d18-8146-94f12d9bcdff.jsonl',
  },
  {
    key: 'lopsided',
    title: 'Lopsided',
    id: 'bb7ebce2',
    note: '#1173 measured 552 rows / 11 Turns / 50.2 rows per Turn. Where equal weight degenerates.',
    dir: '-Users-milad-Developer-argo',
    file: 'bb7ebce2-a75f-4a21-a5be-ebefca35775e.jsonl',
  },
  {
    key: 'longtail',
    title: 'The long tail',
    id: 'b541025d',
    note: '#650. #1173 measured 5,017 rows / 543 Turns. The one that does not fit even at Turn grain.',
    dir: '-Users-milad-Developer-argo--claude-worktrees-ticket-650-atlas-prototype',
    file: 'b541025d-eb89-4c2b-b4a5-01f150850154.jsonl',
  },
]

// ── The measures, transcribed from the app ────────────────────────────────────
// ArgoFeedRow.column 720, .inset ArgoSpacing.section 24 → FeedRowMeasure.measure(atWidth:)
const COLUMN = 720
const MEASURE = COLUMN - 24 * 2
// ArgoFeedRow.bubbleInside(of:) — bubbleShare 0.78, bubbleInsetX ArgoSpacing.loose 16
const BUBBLE_MEASURE = MEASURE * 0.78 - 16 * 2
const BUBBLE_INSET_Y = 12 // ArgoSpacing.comfortable
const ROW_GAP = 16 // ArgoFeedRow.gap, ArgoSpacing.loose — inside the measured height (MinimapRow.topStep)
const BLOCK_STEP = 12 // ArgoFeedRow.blockStep, between two blocks of one message
const LINE = 20 // ProseRhythm.lineHeight
const MACHINE_LINE = 18 // ProseRhythm.machineLineHeight
// MODELLED: the average advance of SF 13 and SF Mono 13. Core Text is what actually wraps.
const PROSE_ADVANCE = 6.6
const MONO_ADVANCE = 7.8
// ArgoFeedRow.collapsedPromptLines — a long prompt stands folded at six lines.
const PROMPT_FOLD_LINES = 6

// ── The projection ────────────────────────────────────────────────────────────

// FeedCall.onlyLooks, by tool name — what FeedSurveyFold is allowed to count rather than draw.
const LOOKING = new Set([
  'Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'WebFetch', 'WebSearch', 'ToolSearch',
  'TaskList', 'TaskGet', 'ListAgents', 'ListMcpResourcesTool', 'ReadMcpResourceTool',
])
const DELEGATE = new Set(['Agent', 'Task', 'Workflow'])

// FeedInk, by row kind.
const INK = {
  prompt: 'prompt',
  message: 'message',
  thought: 'thought',
  call: 'command',
  failure: 'failure',
  survey: 'command',
  ask: 'attention',
  skill: 'command',
  mark: 'boundary',
  unreadable: 'unreadable',
}

function parse(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function blocks(record) {
  const content = record?.message?.content
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return Array.isArray(content) ? content : []
}

// ClaudeInterrupt.isMark — an interrupt arrives on the user side and is punctuation, not a prompt.
function isInterrupt(text) {
  return /^\s*\[Request interrupted/.test(text)
}

// What the CLI writes into the user's side of the record that the user did not type.
//
// The app has `isMeta` and `taskNotification` for this (`TranscriptReader.userEvents`), and the
// record does NOT flag most of it — a slash command, a finished background agent's notification
// and a hook's stdout all arrive as ordinary user text. Read as prompts they name Turns with
// markup, which is what the outline made obvious the moment the Turns were listed as words.
const NOT_TYPED = [
  /^\s*<task-notification>/,
  /^\s*<local-command-stdout>/,
  /^\s*<user-memory-input>/,
  /^\s*Caveat: The messages below/,
  /^\s*\[Image #\d+\]\s*$/,
]

// A slash command IS the user speaking, and its name is the whole of what they said — so the
// wrapper is unwrapped rather than dropped. `<command-name>` is the CLI's spelling of it.
function spoken(text) {
  const command = text.match(/<command-name>([^<]+)<\/command-name>/)
  if (command) {
    const argument = text.match(/<command-args>([^<]*)<\/command-args>/)
    return `${command[1].trim()}${argument?.[1]?.trim() ? ` ${argument[1].trim()}` : ''}`
  }
  if (NOT_TYPED.some((pattern) => pattern.test(text))) return null
  // A system reminder is appended to a real prompt. The words before it are the ones typed.
  const words = text.split('<system-reminder>')[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return words || null
}

function targetOf(input) {
  if (!input || typeof input !== 'object') return ''
  return String(
    input.file_path ?? input.path ?? input.pattern ?? input.notebook_path ?? input.url ?? '',
  )
}

// One record → the row contents it carries, in the record's own order. Every row carries the
// record's own wall clock, which is what the time-mapped variants read.
function contentsOf(record, failed) {
  if (record.isSidechain) return []
  const kind = record.type
  if (kind === 'user') {
    const parts = blocks(record)
    // A record carrying results is the tool answering, never the user asking.
    if (parts.some((p) => p.type === 'tool_result')) return []
    if (record.isCompactSummary) return [{ kind: 'mark', text: '', ends: false }]
    const text = parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('\n')
    if (!text.trim()) return []
    if (isInterrupt(text)) return [{ kind: 'mark', text: '', ends: true }]
    const said = spoken(text)
    // A meta record is the CLI talking to itself; only a skill's body earns a row.
    if (record.isMeta) {
      return /<command-name>|skill/i.test(text) ? [{ kind: 'skill', text: said ?? '' }] : []
    }
    // Text the CLI wrote into the user's side stays in the reading — it happened — but as
    // punctuation: it opens no Turn, carries no words, and is not read at the length of its
    // markup. `FeedProjection` routes a task notification the same way (`reported`).
    return said ? [{ kind: 'prompt', text: said }] : [{ kind: 'mark', text: '', ends: false }]
  }
  if (kind !== 'assistant') return []
  const rows = []
  for (const part of blocks(record)) {
    if (part.type === 'text' && (part.text ?? '').trim()) {
      rows.push({ kind: 'message', text: part.text })
    } else if (part.type === 'thinking' && (part.thinking ?? '').trim()) {
      rows.push({ kind: 'thought', text: part.thinking })
    } else if (part.type === 'tool_use') {
      const name = part.name ?? ''
      rows.push({
        kind: name === 'AskUserQuestion' ? 'ask' : 'call',
        text: `${name} ${targetOf(part.input)}`.trim(),
        tool: name,
        target: targetOf(part.input),
        id: part.id,
        looks: LOOKING.has(name),
        delegate: DELEGATE.has(name),
        failed: failed.has(part.id),
      })
    }
  }
  // The Turn boundary the record reports. `tool_use` is a pause inside a Turn, never its end.
  const stop = record.message?.stop_reason
  if (stop && stop !== 'tool_use') rows.push({ kind: 'mark', text: '', ends: true })
  return rows
}

// FeedCallRun.collapsed — consecutive calls doing the same thing to the same subject read as one.
function collapsed(rows) {
  const out = []
  for (const row of rows) {
    const last = out[out.length - 1]
    if (
      row.kind === 'call' && last?.kind === 'call' && !last.delegate && !row.delegate &&
      last.tool === row.tool && last.text === row.text
    ) {
      last.repeats = (last.repeats ?? 1) + 1
      last.failed = last.failed || row.failed
      continue
    }
    out.push({ ...row })
  }
  return out
}

// FeedSurveyFold.folded — a run of quiet looking becomes one line of counts. A run of one is not
// a fold.
function surveyed(rows) {
  const out = []
  let run = []
  const flush = () => {
    if (run.length > 1) out.push({ kind: 'survey', text: `Read ${run.length}`, count: run.length })
    else out.push(...run)
    run = []
  }
  for (const row of rows) {
    if (row.kind === 'call' && row.looks && !row.failed) {
      run.push(row)
      continue
    }
    flush()
    out.push(row)
  }
  flush()
  return out
}

// ── The height model (MODELLED, see the header) ───────────────────────────────

function wrapped(text, measure, advance) {
  const perLine = Math.max(1, Math.floor(measure / advance))
  let lines = 0
  for (const hard of String(text).split('\n')) {
    lines += Math.max(1, Math.ceil(hard.length / perLine))
  }
  return Math.max(1, lines)
}

// Prose with fences: a fenced run sets at the machine rhythm and a wider advance.
function proseHeight(text, measure) {
  const chunks = String(text).split(/^```.*$/m)
  let height = 0
  chunks.forEach((chunk, at) => {
    const fenced = at % 2 === 1
    height += wrapped(chunk, measure, fenced ? MONO_ADVANCE : PROSE_ADVANCE) *
      (fenced ? MACHINE_LINE : LINE)
  })
  // The step between two blocks of one message.
  const paragraphs = String(text).split(/\n{2,}/).length
  return height + BLOCK_STEP * Math.max(0, paragraphs - 1)
}

function heightOf(row) {
  switch (row.kind) {
    case 'prompt': {
      const lines = Math.min(
        PROMPT_FOLD_LINES,
        wrapped(row.text, BUBBLE_MEASURE, PROSE_ADVANCE),
      )
      return lines * LINE + BUBBLE_INSET_Y * 2 + ROW_GAP
    }
    case 'message':
    case 'thought':
      return proseHeight(row.text, MEASURE) + ROW_GAP
    case 'call':
    case 'survey':
    case 'skill':
      // One sentence however wide the column gets — a call is a slab, not ragged lines.
      return LINE + ROW_GAP
    case 'ask':
      // A card: the question, its options, and the card's own inset either side.
      return LINE * 3 + 12 * 2 + ROW_GAP
    case 'mark':
      // Punctuation. A rule and the room around it.
      return LINE + ROW_GAP
    default:
      return LINE + ROW_GAP
  }
}

// ── TurnExtents.spans ─────────────────────────────────────────────────────────
function spans(rows) {
  const out = []
  let head = 0
  for (let at = 0; at < rows.length; at += 1) {
    if (rows[at].kind === 'prompt' && at > head) {
      out.push([head, at - 1])
      head = at
    }
    if (rows[at].ends) {
      out.push([head, at])
      head = at + 1
    }
  }
  if (head < rows.length) out.push([head, rows.length - 1])
  return out
}

// ── Read one transcript ───────────────────────────────────────────────────────
async function read(spec) {
  const file = path.join(PROJECTS, spec.dir, spec.file)
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  // A call's failure is reported by the result that answered it, which arrives later — so the
  // records are read once for failures and once for rows.
  const records = []
  const failed = new Set()
  for await (const line of lines) {
    if (!line.trim()) continue
    const record = parse(line)
    if (!record) continue
    if (record.type === 'user' && !record.isSidechain) {
      for (const part of blocks(record)) {
        if (part.type === 'tool_result' && part.is_error) failed.add(part.tool_use_id)
      }
    }
    if (record.type === 'user' || record.type === 'assistant') records.push(record)
  }
  const raw = records.flatMap((record) => {
    const at = Date.parse(record.timestamp ?? '') || 0
    return contentsOf(record, failed).map((row) => ({ ...row, at }))
  })
  // UNFOLDED, which #1174 asks for: #1172's work fold lowers the count this lane is asked to
  // draw, and the variants are to be judged at the harder length. The folded count is carried
  // beside it so the two lengths can be compared without a second read.
  const rows = raw
  const turns = spans(rows)
  return { rows, turns, folded: surveyed(collapsed(raw)).length }
}

// What a Turn DID, in the words the hover card needs. A digest and not the rows themselves: the
// card is read at a glance beside the reading, and a list of forty calls is a second feed.
function digest(rows, [from, to]) {
  const tools = new Map()
  const files = new Set()
  let failed = 0, questions = 0, prose = 0, thoughts = 0
  for (let i = from; i <= to; i += 1) {
    const row = rows[i]
    if (row.kind === 'call' || row.kind === 'survey' || row.kind === 'skill') {
      const name = row.tool ?? 'Read'
      tools.set(name, (tools.get(name) ?? 0) + 1)
      // The subject as the call named it, never re-split out of the drawn sentence — a pattern
      // with a space in it came back as half a word.
      const target = row.target ?? ''
      if (target) files.add(target.split('/').pop().slice(0, 28))
    }
    if (row.kind === 'ask') questions += 1
    if (row.failed) failed += 1
    if (row.kind === 'message') prose += 1
    if (row.kind === 'thought') thoughts += 1
  }
  const ranked = [...tools.entries()].sort((a, b) => b[1] - a[1])
  return {
    // The wall clock the Turn ran over, which is what the time-mapped lane maps and what the
    // card says out loud — a reader remembers the long one, not the tall one.
    from: rows[from].at,
    to: rows[to].at,
    work: ranked.reduce((a, [, n]) => a + n, 0),
    tools: ranked.slice(0, 3),
    files: [...files].slice(0, 3),
    failed,
    questions,
    prose,
    thoughts,
  }
}

function statistics(rows, turns) {
  const perTurn = turns.map(([from, to]) => to - from + 1).sort((a, b) => a - b)
  const at = (share) => perTurn[Math.min(perTurn.length - 1, Math.floor(perTurn.length * share))]
  const work = turns.map(([from, to]) => {
    let worked = 0
    for (let i = from; i <= to; i += 1) {
      if (['call', 'survey', 'ask', 'skill'].includes(rows[i].kind)) worked += 1
    }
    return worked / (to - from + 1)
  }).sort((a, b) => a - b)
  return {
    rows: rows.length,
    turns: turns.length,
    rowsPerTurn: Number((rows.length / turns.length).toFixed(1)),
    turnRows: {
      min: perTurn[0],
      p25: at(0.25),
      median: at(0.5),
      p75: at(0.75),
      p90: at(0.9),
      p99: at(0.99),
      max: perTurn[perTurn.length - 1],
    },
    trivialShare: Number(
      (perTurn.filter((n) => n <= 3).length / perTurn.length).toFixed(3),
    ),
    worklessShare: Number((work.filter((w) => w === 0).length / work.length).toFixed(3)),
    workShare: {
      p10: Number(work[Math.floor(work.length * 0.1)].toFixed(2)),
      median: Number(work[Math.floor(work.length * 0.5)].toFixed(2)),
      p90: Number(work[Math.floor(work.length * 0.9)].toFixed(2)),
    },
  }
}

const out = { measures: { column: COLUMN, measure: MEASURE, lineHeight: LINE, rowGap: ROW_GAP }, specimens: [] }
for (const spec of SPECIMENS) {
  const { rows, turns, folded } = await read(spec)
  const heights = rows.map((row) => Math.ceil(heightOf(row)))
  const stats = statistics(rows, turns)
  out.specimens.push({
    key: spec.key,
    title: spec.title,
    id: spec.id,
    note: spec.note,
    stats: { ...stats, foldedRows: folded },
    documentHeight: heights.reduce((a, b) => a + b, 0),
    // Four parallel arrays rather than 5,000 objects — the page reads these into typed arrays.
    heights,
    inks: rows.map((row) => INK[row.failed ? 'failure' : row.kind] ?? 'message'),
    kinds: rows.map((row) => row.kind),
    turns: turns.map(([from, to]) => [from, to]),
    // Every row's wall clock, and what each Turn did — the two the equal-weight variants and the
    // hover card are drawn from.
    times: rows.map((row) => row.at),
    digests: turns.map((span) => digest(rows, span)),
    // The first words of each Turn's prompt, for the label a hover draws. Empty where the Turn
    // opened without one — a promptless exchange, which the lane must not invent words for.
    prompts: turns.map(([from]) => (rows[from].kind === 'prompt' ? rows[from].text.slice(0, 90) : '')),
  })
  console.error(
    `${spec.key}: ${stats.rows} rows, ${stats.turns} Turns, ${stats.rowsPerTurn} rows/Turn, ` +
      `document ${out.specimens[out.specimens.length - 1].documentHeight}pt`,
  )
}

// Written as a SCRIPT rather than as JSON: the page is opened off the filesystem, and a
// `fetch` of a sibling file over `file://` is refused. One `<script src>` is not.
const where = path.join(import.meta.dirname, 'turn-lane-specimens.js')
writeFileSync(where, `window.TURN_LANE = ${JSON.stringify(out)}\n`)
console.error(`wrote ${where}`)
