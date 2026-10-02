import { readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  getSessionMessages,
  getSubagentMessages,
  type SDKMessage,
  type SessionMessage,
  type SessionStoreEntry,
} from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type {
  SessionHistoryTail,
  SessionHistoryTarget,
} from '@/domains/sessions/api/session-history'
import { claudeFeedContent } from './claude-feed'
import { ClaudeFeedProjection } from './claude-feed-projection'
import {
  ClaudeTranscriptTails,
  type TranscriptTail,
  transcriptTailBytes,
} from './claude-transcript-tail'

export function decodeClaudeSessionMessages(messages: readonly SessionMessage[]): FeedContent[] {
  let rejected = 0
  const projection = new ClaudeFeedProjection()
  // A transcript's system records are its own bookkeeping, not the SDK's system messages.
  const content = messages.flatMap((entry) =>
    entry.type === 'system'
      ? []
      : claudeFeedContent(entry as SDKMessage, () => {
          rejected += 1
        }).flatMap((decoded) => projection.project(decoded)),
  )
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Claude history shape(s).`)
  return content
}

// The SDK's own folder name for a working directory; it hashes names past 200 characters, which
// the folder scan below finds instead.
const PROJECT_FOLDER_LIMIT = 200

function claudeProjectsFolder() {
  return path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects')
}

async function isFile(file: string) {
  return stat(file).then(
    (found) => found.isFile(),
    () => false,
  )
}

// The transcript file the SDK would read: under the cwd's folder, else in any project folder, as
// the SDK searches every folder when it is given no cwd. Null when no file holds the Session.
async function claudeTranscriptFile(nativeId: string, cwd: string | null) {
  const projects = claudeProjectsFolder()
  const name = `${nativeId}.jsonl`
  const folder = cwd?.replace(/[^a-zA-Z0-9]/g, '-')
  if (folder !== undefined && folder.length <= PROJECT_FOLDER_LIMIT) {
    const file = path.join(projects, folder, name)
    if (await isFile(file)) return file
  }
  const folders = await readdir(projects).catch(() => [])
  for (const candidate of folders) {
    const file = path.join(projects, candidate, name)
    if (await isFile(file)) return file
  }
  return null
}

const transcriptFiles = new Map<string, string>()
const tails = new ClaudeTranscriptTails()
// The tail a set of parsed lines decodes to; a reopen of an unchanged file decodes nothing again.
const decodedTails = new WeakMap<SessionStoreEntry[], Promise<SessionHistoryTail>>()

async function knownTranscriptFile(nativeId: string, cwd: string | null) {
  const known = transcriptFiles.get(nativeId)
  if (known !== undefined && (await isFile(known))) return known
  const found = await claudeTranscriptFile(nativeId, cwd)
  if (found === null) transcriptFiles.delete(nativeId)
  else transcriptFiles.set(nativeId, found)
  return found
}

type CompactMetadata = {
  preservedSegment?: { uuids?: unknown }
  preservedMessages?: { headUuid?: unknown }
}

// A compaction whose kept messages lie before the tail; the SDK joins them to the chain only when
// it holds every one of them.
function cutPreservedMessages(
  entries: readonly SessionStoreEntry[],
  held: ReadonlyMap<string | undefined, unknown>,
) {
  return entries.some((entry) => {
    const { preservedSegment, preservedMessages } = ((
      entry as { compactMetadata?: CompactMetadata }
    ).compactMetadata ?? {}) as CompactMetadata
    const uuids = Array.isArray(preservedSegment?.uuids) ? preservedSegment.uuids : []
    const head = preservedMessages?.headUuid
    return (
      uuids.some((uuid) => typeof uuid === 'string' && !held.has(uuid)) ||
      (typeof head === 'string' && !held.has(head))
    )
  })
}

// The chain the SDK builds from these lines alone, and whether it reaches the Session's start: a
// first message whose parent is not among the lines was cut off by the tail.
async function decodeTail(
  { nativeId, cwd }: SessionHistoryTarget,
  { entries, whole }: TranscriptTail,
): Promise<SessionHistoryTail> {
  const sessionStore = { append: async () => {}, load: async () => entries }
  const messages = await getSessionMessages(nativeId, {
    ...(cwd === null ? {} : { dir: cwd }),
    sessionStore,
  })
  const content = decodeClaudeSessionMessages(messages)
  if (whole) return { content, complete: true }
  const byUuid = new Map(entries.map((entry) => [entry.uuid, entry]))
  let parent = byUuid.get(messages[0]?.uuid ?? '')?.parentUuid
  const seen = new Set<unknown>()
  while (typeof parent === 'string' && byUuid.has(parent) && !seen.has(parent)) {
    seen.add(parent)
    parent = byUuid.get(parent)?.parentUuid
  }
  const reachesStart = messages.length > 0 && typeof parent !== 'string'
  return { content, complete: reachesStart && !cutPreservedMessages(entries, byUuid) }
}

export async function readClaudeSessionHistory(
  target: SessionHistoryTarget,
  extent: number,
): Promise<SessionHistoryTail> {
  const { nativeId, cwd, subagentId } = target
  const options = cwd === null ? {} : { dir: cwd }
  if (subagentId !== null) {
    const messages = await getSubagentMessages(nativeId, subagentId, options)
    return { content: decodeClaudeSessionMessages(messages), complete: true }
  }
  const file = await knownTranscriptFile(nativeId, cwd)
  if (file === null) {
    const messages = await getSessionMessages(nativeId, options)
    return { content: decodeClaudeSessionMessages(messages), complete: true }
  }
  const tail = await tails.read(file, transcriptTailBytes(extent))
  let decoded = decodedTails.get(tail.entries)
  if (decoded === undefined) {
    decoded = decodeTail(target, tail)
    decodedTails.set(tail.entries, decoded)
    decoded.catch(() => decodedTails.delete(tail.entries))
  }
  return decoded
}
