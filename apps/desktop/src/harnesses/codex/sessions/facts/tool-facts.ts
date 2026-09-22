// The rollout's `response_item` lines carry a model's tool use as four record types:
// `function_call`/`custom_tool_call` (the call) and `function_call_output`/
// `custom_tool_call_output` (its result), linked by a shared `call_id`. This reads both pairs
// onto the shared ToolCall/ToolResult shapes (CONTEXT.md L3 · Tool Call) the Claude adapter
// already produces, so `toolPresentation()` and `tool-groups.ts` draw them with no change.

import type {
  EditedFile,
  EditFacts,
  ExecuteFacts,
  FetchFacts,
  OtherFacts,
  ReadFacts,
  SearchFacts,
  ToolCall,
  TranscriptRecord,
} from '@/domains/sessions/contract/model'
import { mcpOther } from '@/domains/sessions/contract/model'
import { isRecord } from '@/shared/validation'
import { nextQuotedState, openedQuote, type Quote } from '../javascript-string'
import { messageRecord } from '../records/message-record'
import { readToolResults } from '../records/rich-results'
import { readSubagentCall } from './subagent-calls'

// Codex's `apply_patch` carries its change as one text (codex-rs/apply-patch): `*** Begin Patch`,
// then per file `*** Add File: p`, `*** Update File: p` (optionally `*** Move to: p`) or
// `*** Delete File: p`, hunks under bare `@@` lines, and `*** End Patch`.
const FILE_HEADER = /^\*\*\* (Add|Update|Delete) File: (.+)$/
const ENVELOPE = /^\*\*\* (Begin|End) Patch$/

const CHANGES = { Add: 'create', Update: 'update', Delete: 'delete' } as const

// Each file's diff opens with its `Update File: p` line, which the diff viewer splits on, and
// its bare `@@` becomes a hunk header the viewer can number lines from.
export function readPatchFiles(patch: string): EditedFile[] {
  const files: (EditedFile & { lines: string[] })[] = []
  for (const line of patch.split('\n')) {
    const header = FILE_HEADER.exec(line)
    if (header !== null) {
      const verb = header[1] as keyof typeof CHANGES
      files.push({
        change: CHANGES[verb],
        file: header[2] ?? null,
        diff: '',
        lineCounts: { added: 0, removed: 0 },
        lines: [line.slice('*** '.length)],
      })
      continue
    }
    const current = files.at(-1)
    if (current === undefined || ENVELOPE.test(line)) continue
    current.lines.push(line.startsWith('@@') ? '@@ -0,0 +0,0 @@' : line)
    if (line.startsWith('+')) current.lineCounts.added += 1
    if (line.startsWith('-')) current.lineCounts.removed += 1
  }
  return files.map(({ lines, ...file }) => ({ ...file, diff: lines.join('\n') }))
}

// The patch is the call's own `patch` field when a script named it, else the bare text of a
// direct `custom_tool_call`.
function patchText(input: Record<string, unknown>): string | null {
  const text = typeof input.patch === 'string' ? input.patch : input.input
  return typeof text === 'string' ? text : null
}

// A Codex `apply_patch` as the domain's `edit` Tool Call. A patch that names no file still draws
// as an edit, of a file the row cannot name.
export function editFacts(name: string, input: Record<string, unknown>): EditFacts | null {
  if (name !== 'apply_patch') return null
  const patch = patchText(input)
  const files = patch === null ? [] : readPatchFiles(patch)
  const unnamed: EditedFile = {
    change: 'update',
    file: null,
    diff: '',
    lineCounts: { added: 0, removed: 0 },
  }
  return { kind: 'edit', files: files.length === 0 ? [unnamed] : files }
}

type Input = Record<string, unknown>
type LookupFacts = ReadFacts | SearchFacts | FetchFacts

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const webSearch = (query: string | null): LookupFacts => ({
  kind: 'search',
  scope: 'web',
  query,
})

// A search action carries `query`, and `queries` when the model fanned it out.
function searchQuery(input: Input): string | null {
  const [first] = Array.isArray(input.queries) ? input.queries : []
  return text(input.query) ?? text(first)
}

// The web actions of a rollout `web_search_call` item, keyed by `action.type`.
const WEB_SEARCH_ACTIONS: Record<string, (input: Input) => LookupFacts> = {
  search: (input) => webSearch(searchQuery(input)),
  open_page: (input) => ({ kind: 'fetch', url: text(input.url) }),
  find_in_page: (input) => webSearch(text(input.pattern)),
}

function pick<Value>(table: Record<string, Value>, key: string): Value | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

// Every Codex tool that reads, searches or fetches, keyed by its tool name. `web__run` is a
// fetch when it names a page and a search when it names a query.
const LOOKUPS: Record<string, (input: Input) => LookupFacts> = {
  web__run: (input) => {
    const url = text(input.url)
    return url === null ? webSearch(searchQuery(input)) : { kind: 'fetch', url }
  },
  'web.search': (input) => webSearch(searchQuery(input)),
  web_search_call: (input) => {
    const action = typeof input.type === 'string' ? input.type : ''
    return pick(WEB_SEARCH_ACTIONS, action)?.(input) ?? webSearch(null)
  },
  view_image: (input) => ({ kind: 'read', target: text(input.path) }),
}

export function lookupFacts(name: string, input: Input): LookupFacts | null {
  return pick(LOOKUPS, name)?.(input) ?? null
}

// Orchestration tools, each with the words its row says.
const ORCHESTRATION_LABELS: Record<string, string> = {
  js: 'Ran a script',
  update_plan: 'Updated the plan',
  update_goal: 'Updated the goal',
  create_goal: 'Set the goal',
  get_goal: 'Read the goal',
  request_user_input: 'Asked a question',
}

function otherInputText(input: Record<string, unknown>): string | null {
  const code = text(input.code)
  if (code !== null) return code
  const entries = Object.entries(input)
  const entry = entries[0]
  if (entry === undefined) return null
  const [, value] = entry
  return entries.length === 1 && typeof value === 'string' ? value : JSON.stringify(input, null, 2)
}

// Any call no other kind claimed is `other`, so a tool Argo has never seen still draws a row.
export function otherFacts(name: string, input: Record<string, unknown>): OtherFacts | null {
  const mcp = mcpOther(name)
  if (mcp !== null) return { ...mcp, text: null }
  const known = Object.hasOwn(ORCHESTRATION_LABELS, name) ? ORCHESTRATION_LABELS[name] : undefined
  return {
    kind: 'other',
    label: text(input.title) ?? known ?? `Ran ${name}`,
    text: otherInputText(input),
    source: null,
  }
}

// The legacy `shell` call passes argv, usually `["bash", "-lc", "<script>"]`; the script is the command.
function argvCommand(value: unknown): string | null {
  if (!Array.isArray(value) || !value.every((part) => typeof part === 'string')) return null
  const [, flag, script] = value
  const shellScript = flag !== undefined && /^-\w*c$/.test(flag) ? script : value.join(' ')
  return text(shellScript)
}

// Every command shape Codex writes, keyed by its tool name: `exec_command` and `exec`, and the
// legacy `shell` (argv) and `shell_command` (string). `command` is what ran; `wrapper` is the
// script an `exec` call carries when no command could be lifted out of it.
const COMMANDS: Record<
  string,
  (input: Input) => { command: string | null; wrapper?: string | null }
> = {
  exec_command: (input) => ({ command: text(input.cmd) }),
  exec: (input) => ({ command: text(input.cmd), wrapper: text(input.input) }),
  shell: (input) => ({ command: argvCommand(input.command) }),
  shell_command: (input) => ({ command: text(input.command) }),
}

function firstLine(command: string | null): string | null {
  return command?.trim().split('\n', 1).join('') ?? null
}

export function commandFacts(name: string, input: Input): ExecuteFacts | null {
  const read = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined
  if (read === undefined) return null
  const { command, wrapper = null } = read(input)
  return {
    kind: 'execute',
    command: firstLine(command),
    label: text(input.label) ?? text(input.description),
    text: command ?? wrapper,
    background: false,
  }
}

// Any `tools.<name>(` the script reaches as code: assigned, awaited inline, or inside a callback.
const TOOL_CALL = /tools\.([A-Za-z][A-Za-z0-9_]*)\s*\(/y

// Every index of the script that is code: not inside a string, and not inside a line comment.
function* codeIndexes(input: string, start = 0): Generator<number> {
  let quote: Quote | null = null
  let escaped = false
  for (let index = start; index < input.length; index += 1) {
    const character = input.charAt(index)
    if (quote !== null) {
      const nextState = nextQuotedState(character, quote, escaped)
      quote = nextState.quote
      escaped = nextState.escaped
      continue
    }
    quote = openedQuote(character)
    if (quote !== null) continue
    if (input.startsWith('//', index)) {
      const lineEnd = input.indexOf('\n', index)
      if (lineEnd === -1) return
      index = lineEnd
      continue
    }
    yield index
  }
}

function spanUntilClose(input: string, start: number, [open, close]: readonly [string, string]) {
  let depth = 1
  for (const index of codeIndexes(input, start)) {
    const character = input.charAt(index)
    if (character === open) depth += 1
    if (character === close) {
      depth -= 1
      if (depth === 0) return input.slice(start, index)
    }
  }
  return null
}

function argumentsUntilClose(input: string, start: number): string | null {
  return spanUntilClose(input, start, ['(', ')'])
}

// The first match of a sticky pattern that starts in code rather than inside a string.
export function codeMatch(input: string, pattern: RegExp): RegExpExecArray | null {
  for (const index of codeIndexes(input)) {
    pattern.lastIndex = index
    const match = pattern.exec(input)
    if (match !== null) return match
  }
  return null
}

// The array literal a script assigns to `name` before passing the variable to a tool, as in
// `const plan = [...]; await tools.update_plan({plan})`.
export function arrayAssignedTo(input: string, name: string): string | null {
  const assignment = codeMatch(input, new RegExp(`(?<![A-Za-z0-9_$.])${name}\\s*=\\s*\\[`, 'y'))
  if (assignment === null) return null
  const body = spanUntilClose(input, assignment.index + assignment[0].length, ['[', ']'])
  return body === null ? null : `[${body}]`
}

export function nestedToolCall(input: string): { name: string; argumentsText: string } | null {
  return nestedToolCalls(input)[0] ?? null
}

export function nestedToolCalls(input: string): { name: string; argumentsText: string }[] {
  const calls: { name: string; argumentsText: string }[] = []
  let resumeAt = 0
  for (const index of codeIndexes(input)) {
    if (index < resumeAt) continue
    TOOL_CALL.lastIndex = index
    const name = TOOL_CALL.exec(input)?.[1]
    if (name === undefined) continue
    const start = TOOL_CALL.lastIndex
    const argumentsText = argumentsUntilClose(input, start)
    if (argumentsText === null) break
    calls.push({ name, argumentsText })
    resumeAt = start + argumentsText.length
  }
  return calls
}

const QUOTED = String.raw`"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\x60((?:[^\x60\\]|\\.)*)\x60`
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r' }

function unescaped(literal: string) {
  return literal.replace(/\\(.)/g, (_, character: string) => ESCAPES[character] ?? character)
}

export function quotedAfter(value: string, lead: string): string | null {
  const match = value.match(new RegExp(String.raw`${lead}\s*(?:${QUOTED})`))
  const found = match?.[1] ?? match?.[2] ?? match?.[3] ?? null
  return found === null ? null : unescaped(found)
}

function writtenField(value: string, key: string): string | null {
  return quotedAfter(value, String.raw`["']?${key}["']?\s*:`)
}

function fieldVariable(value: string, key: string): string | null {
  return value.match(new RegExp(String.raw`["']?${key}["']?\s*:\s*([A-Za-z_$][\w$]*)`))?.[1] ?? null
}

function assignedString(value: string, name: string): string | null {
  return quotedAfter(value, String.raw`(?:const|let|var)\s+${name}\s*=`)
}

export function readToolCallInput(
  value: unknown,
  script = typeof value === 'string' ? value : '',
): Record<string, unknown> {
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : { arguments: parsed }
  } catch {
    const cmd = writtenField(value, 'cmd')
    const workdir =
      writtenField(value, 'workdir') ??
      (() => {
        const name = fieldVariable(value, 'workdir')
        return name === null ? null : assignedString(script, name)
      })()
    const query = writtenField(value, 'q')
    const url = [writtenField(value, 'ref_id'), writtenField(value, 'url')].find(
      (found) => found?.startsWith('http') === true,
    )
    const path = writtenField(value, 'path')
    return {
      arguments: value,
      ...(cmd === null ? {} : { cmd }),
      ...(workdir === null ? {} : { workdir }),
      ...(path === null ? {} : { path }),
      ...(query === null ? {} : { query }),
      ...(url === undefined ? {} : { url }),
    }
  }
}

// `function_call`'s arguments are a JSON object serialised as a string; a `custom_tool_call`'s
// `input` is the bare string the model wrote (a script), so it is kept as a single field rather
// than parsed, matching how `toolPresentation()`'s fallback reads a one-field input.
// A script often writes its arguments as JavaScript, not JSON (`"workdir":wd`, `cmd:\`…\``); the
// command, or a web search's first query (`q:"…"`) or opened page (`ref_id:"https://…"`), is
// still one quoted string, and it is the one the Feed labels the call by.

// `tools.apply_patch(patch)` names a constant the script declared above it, or quotes the patch.
function patchArgument(script: string, argumentsText: string): string | null {
  const identifier = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(argumentsText)?.[1]
  if (identifier !== undefined)
    return quotedAfter(script, String.raw`(?:const|let|var)\s+${identifier}\s*=`)
  return quotedAfter(argumentsText, '^\\s*')
}

type RawToolCall = { id: string; name: string; input: Record<string, unknown> }

// `write_stdin`, `wait` and `sleep` poll a command `exec_command` already drew; Codex shows none.
const COMMAND_POLLS = new Set(['write_stdin', 'wait', 'sleep'])

// Codex draws each of these as the Agent's own activity (`SubAgentActivity`), never as a tool row.
const COLLABORATION_CALLS = new Set([
  'spawn_agent',
  'wait_agent',
  'send_message',
  'followup_task',
  'list_agents',
  'interrupt_agent',
])

function rawToolCalls(payload: Record<string, unknown>): RawToolCall[] {
  if (typeof payload.call_id !== 'string' || typeof payload.name !== 'string') return []
  if (COMMAND_POLLS.has(payload.name)) return []
  if (payload.type === 'function_call')
    return [
      { id: payload.call_id, name: payload.name, input: readToolCallInput(payload.arguments) },
    ]
  if (payload.type !== 'custom_tool_call' || typeof payload.input !== 'string') return []
  const script = payload.input
  if (payload.name !== 'exec')
    return [{ id: `${payload.call_id}:0`, name: payload.name, input: { input: script } }]
  const nested = nestedToolCalls(script)
  return nested.length === 0
    ? [{ id: `${payload.call_id}:0`, name: payload.name, input: { input: script } }]
    : nested
        .map(({ name, argumentsText }, index) => ({
          id: `${payload.call_id}:${index}`,
          name,
          input:
            name === 'apply_patch'
              ? { patch: patchArgument(script, argumentsText) ?? argumentsText }
              : readToolCallInput(argumentsText, script),
        }))
        .filter((call) => !COMMAND_POLLS.has(call.name))
}

// A `web_search_call` item is the call and its outcome in one line, so it lands with its own
// result. `web.search` and `web__run` are the same act written as a function call.
function classified({ id, name, input }: RawToolCall): ToolCall {
  const facts =
    commandFacts(name, input) ??
    lookupFacts(name, input) ??
    editFacts(name, input) ??
    otherFacts(name, input)
  return { id, ...(facts ?? { kind: 'other', label: `Ran ${name}`, text: null, source: null }) }
}

function commandWorkingDirectory(calls: RawToolCall[]): string | null {
  const call = calls.findLast(
    ({ name, input }) => commandFacts(name, input) !== null && typeof input.workdir === 'string',
  )
  return typeof call?.input.workdir === 'string' ? call.input.workdir : null
}

function readWebSearchRecord(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (typeof payload.id !== 'string') return null
  const call = classified({
    id: payload.id,
    name: 'web_search_call',
    input: isRecord(payload.action) ? payload.action : {},
  })
  return messageRecord(record, {
    uuid: payload.id,
    role: 'assistant',
    originSessionId: null,
    blocks: [{ shape: 'tool', callId: call.id }],
    toolCalls: [call],
    toolResults: [{ callId: call.id, blocks: [], failed: payload.status === 'failed' }],
  })
}

// The call becomes the row itself (an assistant delivery); its result carries no block of its
// own, matching how a Claude `tool_result` lands in a message with nothing left to draw.
export function readToolRecord(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
    const calls = rawToolCalls(payload)
    if (calls.length === 0 || typeof payload.id !== 'string') return null
    if (calls.every((call) => COLLABORATION_CALLS.has(call.name)))
      return {
        kind: 'trace',
        uuid: payload.id,
        boundary: true,
        ...readSubagentCall(record, calls),
      }
    const visible = calls.filter((call) => !COLLABORATION_CALLS.has(call.name)).map(classified)
    return messageRecord(record, {
      uuid: payload.id,
      role: 'assistant',
      originSessionId: null,
      blocks: visible.map((call) => ({ shape: 'tool' as const, callId: call.id })),
      cwd: commandWorkingDirectory(calls),
      toolCalls: visible,
    })
  }
  if (payload.type === 'web_search_call') return readWebSearchRecord(record, payload)
  if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
    const results = readToolResults(payload)
    if (results.length === 0 || typeof payload.id !== 'string') return null
    return messageRecord(record, {
      uuid: payload.id,
      role: 'user',
      originSessionId: null,
      blocks: [],
      toolResults: results,
    })
  }
  return null
}

// Codex writes each summary as a Markdown headline (`**Reading the plan**`); the Feed draws a
// thought as plain text, so the markers come off here.
function thoughtText(summary: string): string {
  return summary.replaceAll('**', '')
}

export function reasoningSummary(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type !== 'reasoning' || typeof payload.id !== 'string') return null
  if (!Array.isArray(payload.summary)) return null
  const blocks = payload.summary.flatMap((summary) => {
    if (!isRecord(summary) || summary.type !== 'summary_text' || typeof summary.text !== 'string')
      return []
    return [{ shape: 'thought' as const, text: thoughtText(summary.text) }]
  })
  if (blocks.length === 0) return null
  return messageRecord(record, {
    uuid: payload.id,
    role: 'assistant',
    originSessionId: null,
    blocks,
  })
}
