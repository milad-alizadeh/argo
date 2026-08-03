import {
  type Agent,
  derived,
  direct,
  type SessionCreated,
  type SessionIntake,
  type SessionPosture,
  type SessionStatus,
  type SessionUpdated,
  sessionFacts,
  type Tiered,
} from '../../shared'
import { latestInChain, maxInChain } from './resumeChain'
import type { LogicalSession, ObservedSession } from './types'

/** Grade the Session's status FROM its tree, so the two readings can never be differently timed. */
export type GradeStatus = (agents: Agent[]) => Tiered<SessionStatus>

// Stamp the tiered observation the roster renders. The leaf (most recent) file wins for
// title and cwd recency, falling back across the resume chain when the leaf lacks a field.
// An ai-title is DIRECT (the CLI's own title); a first-prompt fallback is DERIVED; a missing
// title is a DERIVED placeholder — never a fact invented from prose in the transcript.
export function toObservedSession(
  logical: LogicalSession,
  posture: SessionPosture,
  gradeStatus: GradeStatus,
): ObservedSession {
  const aiTitle = latestInChain(logical.files, (file) => file.aiTitle)
  const firstPrompt = latestInChain(logical.files, (file) => file.firstPrompt)
  const cwd = latestInChain(logical.files, (file) => file.cwd)
  const model = latestInChain(logical.files, (file) => file.model)
  const branch = latestInChain(logical.files, (file) => file.gitBranch)
  const lastActivityAt = maxInChain(logical.files, (file) => file.lastTimestampMs)
  const agents = toAgents(logical)

  return {
    id: logical.id,
    fileIds: logical.fileIds,
    cli: 'claude',
    posture,
    title: resolveTitle(aiTitle, firstPrompt),
    cwd: cwd === null ? null : direct(cwd),
    model: model === null ? null : direct(model),
    branch: branch === null ? null : direct(branch),
    lastActivityAt: lastActivityAt === null ? null : derived(lastActivityAt),
    status: gradeStatus(agents),
    agents,
  }
}

/**
 * Assemble the flat runtime tree for one logical Session. The Session IS the root Agent
 * (`parentId: null`), keyed by the chain id, and its Turns are every file's Turns in chain order
 * — the resume chain stitches ACROSS a compaction rather than starting a second tree. Each
 * Subagent is a non-root Agent parented to the root; there is no `kind` discriminant anywhere.
 */
function toAgents(logical: LogicalSession): Agent[] {
  const root: Agent = {
    id: logical.id,
    parentId: null,
    turns: logical.files.flatMap((file) => file.tree.turns),
    compactions: logical.files.flatMap((file) => file.tree.compactions),
  }
  const subagents = logical.files.flatMap((file) =>
    file.tree.subagents.map(
      (seed): Agent => ({ ...seed, parentId: root.id, turns: [], compactions: [] }),
    ),
  )
  return [root, ...subagents]
}

function resolveTitle(aiTitle: string | null, firstPrompt: string | null): Tiered<string> {
  if (aiTitle !== null) return direct(aiTitle)
  if (firstPrompt !== null) return derived(firstPrompt)
  return derived('Untitled session')
}

// Cross the Seam B → Seam A contract. SessionView carries the graded VALUE only (its shape is
// frozen); the honesty tiers are the adapter's tested guarantee, not something the bridge ships.
function toIntake(observed: ObservedSession): SessionIntake {
  return {
    id: observed.id,
    title: observed.title.value,
    cli: 'claude',
    cwd: observed.cwd?.value ?? null,
    model: observed.model?.value ?? null,
    branch: observed.branch?.value ?? null,
    lastActivityAt: observed.lastActivityAt?.value ?? null,
    posture: observed.posture,
    facts: sessionFacts({ status: observed.status.value }),
    agents: observed.agents,
  }
}

export function toSessionEvent(observed: ObservedSession): SessionCreated {
  return { type: 'session-created', session: toIntake(observed) }
}

/** The incremental event: a later reading of a Session the roster already holds. */
export function toSessionUpdate(observed: ObservedSession): SessionUpdated {
  return { type: 'session-updated', session: toIntake(observed) }
}
