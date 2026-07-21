import {
  derived,
  direct,
  type HubEvent,
  type SessionStatus,
  sessionFacts,
  type Tiered,
} from '../../shared'
import { latestInChain } from './resumeChain'
import type { LogicalSession, ObservedSession } from './types'

// Stamp the tiered observation the roster renders. The leaf (most recent) file wins for
// title and cwd recency, falling back across the resume chain when the leaf lacks a field.
// An ai-title is DIRECT (the CLI's own title); a first-prompt fallback is DERIVED; a missing
// title is a DERIVED placeholder — never a fact invented from prose in the transcript.
export function toObservedSession(
  logical: LogicalSession,
  status: Tiered<SessionStatus>,
): ObservedSession {
  const aiTitle = latestInChain(logical.files, (file) => file.aiTitle)
  const firstPrompt = latestInChain(logical.files, (file) => file.firstPrompt)
  const cwd = latestInChain(logical.files, (file) => file.cwd)

  return {
    id: logical.id,
    fileIds: logical.fileIds,
    cli: 'claude',
    source: 'external',
    title: resolveTitle(aiTitle, firstPrompt),
    cwd: cwd === null ? null : direct(cwd),
    status,
  }
}

function resolveTitle(aiTitle: string | null, firstPrompt: string | null): Tiered<string> {
  if (aiTitle !== null) return direct(aiTitle)
  if (firstPrompt !== null) return derived(firstPrompt)
  return derived('Untitled session')
}

// Cross the Seam B → Seam A contract. SessionView carries the graded VALUE only (its shape is
// frozen); the honesty tiers are the adapter's tested guarantee, not something the bridge ships.
export function toSessionEvent(observed: ObservedSession): HubEvent {
  return {
    type: 'session-created',
    session: {
      id: observed.id,
      title: observed.title.value,
      cli: 'claude',
      facts: sessionFacts({ status: observed.status.value }),
    },
  }
}
