import type { SessionStatus, Tiered } from '../../shared'

export type SessionSource = 'external' | 'managed'

/** One parsed transcript file — the pure product of reading one .jsonl, untrusted input already tamed. */
export interface ParsedTranscript {
  sessionId: string
  headLeafUuid: string | null // from the line-0 last-prompt record
  messageUuids: string[] // every record uuid seen (for resume-chain matching)
  cwd: string | null // DIRECT when present
  aiTitle: string | null // DIRECT title when present
  firstPrompt: string | null // fallback title source (DERIVED)
  lastTimestampMs: number | null // newest record timestamp (DERIVED recency signal)
}

/** A resume-chain stitched into one logical rail Session. Nothing is re-keyed: each file keeps its own sessionId. */
export interface LogicalSession {
  id: string // logical id = ROOT file's sessionId
  fileIds: string[] // root → leaf, each file's own sessionId, in chain order
  files: ParsedTranscript[] // same order as fileIds
}

/** The tiered observation the adapter stamps — the untrusted-input boundary's output. */
export interface ObservedSession {
  id: string
  fileIds: string[]
  cli: 'claude'
  source: SessionSource
  title: Tiered<string>
  cwd: Tiered<string> | null
  status: Tiered<SessionStatus>
}
