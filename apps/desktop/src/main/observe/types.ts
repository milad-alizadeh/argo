import type { Agent, SessionPosture, SessionStatus, Tiered } from '../../shared'
import type { ParsedTree } from './tree'

/** One parsed transcript file — the pure product of reading one .jsonl, untrusted input already tamed. */
export interface ParsedTranscript {
  sessionId: string
  headLeafUuid: string | null // from the line-0 last-prompt record
  messageUuids: string[] // every record uuid seen (for resume-chain matching)
  cwd: string | null // DIRECT when present
  model: string | null // DIRECT: the id off the LATEST assistant record — a run can switch model
  gitBranch: string | null // DIRECT: the LATEST reading — a run can switch branch
  aiTitle: string | null // DIRECT title when present
  firstPrompt: string | null // fallback title source (DERIVED)
  firstTimestampMs: number | null // oldest record timestamp (DERIVED: which claim window it began in)
  lastTimestampMs: number | null // newest record timestamp (DERIVED recency signal)
  tree: ParsedTree // this file's slice of the runtime tree (CONTEXT.md L3)
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
  posture: SessionPosture
  title: Tiered<string>
  cwd: Tiered<string> | null
  model: Tiered<string> | null
  branch: Tiered<string> | null
  lastActivityAt: Tiered<number> | null
  status: Tiered<SessionStatus>
  /** The flat runtime tree: the root Agent (`parentId: null`) plus its Subagents. */
  agents: Agent[]
}
