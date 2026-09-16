import { isIdentifier } from '@/boundary'
import type { ContentBlock, TranscriptMessage, TranscriptRecord } from '@/core/sessions/transcript'
import { taggedField } from '../../envelope-tags'
import { mentionedBlocks, readMentionedFiles } from './mentioned-files'
import { withoutChannelTag } from './realtime-replies'

// The envelopes a user message can carry that `userRecord` reads.
export const USER_HARNESS_ENVELOPES = new Set([
  'heartbeat',
  'realtime_delegation',
  'in-app-browser-context',
])

function wholeEnvelope(text: string, name: string): string | null {
  return new RegExp(`^\\s*<${name}(?:\\s[^>]*)?>([\\s\\S]*)</${name}>\\s*$`).exec(text)?.[1] ?? null
}

// Codex desktop's heartbeat reply, as its `## Heartbeats` developer instructions define it: prose
// for the person is allowed only before a `NOTIFY` block, and a `DONT_NOTIFY` turn stays quiet.
const HEARTBEAT_REPLY =
  /<heartbeat>([\s\S]*?<decision>\s*(?:NOTIFY|DONT_NOTIFY)\s*<\/decision>[\s\S]*?)<\/heartbeat>/

function replyBlocks(text: string): ContentBlock[] {
  const reply = HEARTBEAT_REPLY.exec(text)
  if (reply === null) return text.trim() === '' ? [] : [{ shape: 'prose', text }]
  const around = [text.slice(0, reply.index), text.slice(reply.index + reply[0].length)]
  const [before, after] = around.map((part) => part.trim())
  const body = reply[1] ?? ''
  const notice: ContentBlock[] =
    taggedField(body, 'decision') === 'NOTIFY'
      ? [{ shape: 'event', event: 'status', text: taggedField(body, 'message') }]
      : []
  const prose = (part: string | undefined): ContentBlock[] =>
    part ? [{ shape: 'prose', text: part }] : []
  return [...prose(before), ...notice, ...prose(after)]
}

// A heartbeat turn that decided not to notify, or a reply with no text, draws nothing; it still
// separates the Tool runs either side of it, like any hidden harness delivery.
function assistantRecord(message: TranscriptMessage): TranscriptRecord {
  const blocks = message.blocks.flatMap((block) =>
    block.shape === 'prose' ? replyBlocks(withoutChannelTag(block.text)) : [block],
  )
  if (blocks.length === 0) return { kind: 'trace', uuid: message.uuid, boundary: true }
  return { ...message, blocks }
}

// Codex realtime voice hands the thread what the person said as `<input>`, with the spoken
// conversation so far beside it for the model: the same envelope the Claude adapter reads.
function realtimeDelegation(uuid: string, body: string): TranscriptRecord {
  const action = taggedField(body, 'input')
  if (action === null) return { kind: 'trace', uuid }
  const id = taggedField(body, 'id')
  return {
    kind: 'delegation',
    uuid,
    actor: 'agent',
    action,
    status: taggedField(body, 'status'),
    progress: taggedField(body, 'progress'),
    groupId: id !== null && isIdentifier(id) ? id : null,
    callId: null,
  }
}

// Codex strips a model-context prefix before this heading (`USER_MESSAGE_BEGIN`, codex-rs
// protocol.rs); the desktop app's in-app browser writes the shorter form.
const REQUEST_HEADING = /^\s*## My request(?: for Codex)?:\s*/

const AMBIENT_CONTEXT = /^\s*<in-app-browser-context(?:\s[^>]*)?>[\s\S]*?<\/in-app-browser-context>/

// The desktop app wraps a request in its attached files and browser state, in that order.
function requestBlocks(text: string, hasImage: boolean): ContentBlock[] {
  const mentioned = readMentionedFiles(text)
  const rest = (mentioned?.rest ?? text).replace(AMBIENT_CONTEXT, '')
  const request = rest === text ? text : rest.replace(REQUEST_HEADING, '').trim()
  const files = mentionedBlocks(mentioned?.paths ?? [], hasImage)
  return [...(request === '' ? [] : [{ shape: 'prose' as const, text: request }]), ...files]
}

// The heartbeat that wakes a thread is written by the system on a schedule, not by the person.
function userRecord(message: TranscriptMessage): TranscriptRecord {
  const [only] = message.blocks
  const text = message.blocks.length === 1 && only?.shape === 'prose' ? only.text : ''
  if (wholeEnvelope(text, 'heartbeat') !== null)
    return { kind: 'trace', uuid: message.uuid, boundary: true }
  const delegation = wholeEnvelope(text, 'realtime_delegation')
  if (delegation !== null) return realtimeDelegation(message.uuid, delegation)
  const hasImage = message.blocks.some((block) => block.shape === 'image')
  const blocks = message.blocks.flatMap((block) =>
    block.shape === 'prose' ? requestBlocks(block.text, hasImage) : [block],
  )
  return { ...message, blocks }
}

// A thread Codex's voice session opens through `codex_app.create_thread` writes no prompt: what
// it was asked is the `<input>` of the `<codex_delegation>` that tool returns into it.
export function delegatedRequest(output: string): string | null {
  const delegation = wholeEnvelope(output, 'codex_delegation')
  return delegation === null ? null : taggedField(delegation, 'input')
}

// Codex and its desktop app write their own machinery into message text as XML envelopes; this
// reads each one as the Feed should show it instead of as the person's or the agent's words.
export function readHarnessEnvelopes(message: TranscriptMessage): TranscriptRecord {
  return message.role === 'user' ? userRecord(message) : assistantRecord(message)
}

const HEARTBEAT_TAG = '<heartbeat'

// A streamed heartbeat reply is shown only up to its block, which is never meant for the reader;
// a delta can end part-way through the tag, so a trailing start of it is held back too.
export function draftText(streamed: string): string {
  const text = withoutChannelTag(streamed)
  const cut = text.indexOf(HEARTBEAT_TAG)
  if (cut >= 0) return text.slice(0, cut).trimEnd()
  for (let length = HEARTBEAT_TAG.length - 1; length > 0; length -= 1)
    if (text.endsWith(HEARTBEAT_TAG.slice(0, length))) return text.slice(0, -length).trimEnd()
  return text
}
