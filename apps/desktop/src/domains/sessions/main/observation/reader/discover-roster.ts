// The one order every adapter's discovery ends in: observed joins, the managed merge, the joins
// that read posture, then Project scope (CONTEXT.md L2 · Roster).

import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import { mergeManagedRoster } from '../../lifecycle'
import { belongsToProject, projectRootsOf } from '../../project-scope'
import type { TranscriptDiscovery } from './discover-transcript-sessions'

export type RosterJoin = (
  rows: SessionRosterRow[],
) => SessionRosterRow[] | Promise<SessionRosterRow[]>

type RosterDiscovery = {
  discovery: TranscriptDiscovery
  managed: SessionRosterRow[]
  joins: {
    // What the Harness recorded, so the held row's tie-break still sees it as the observed side.
    observed?: readonly RosterJoin[]
    // Facts that read a row's posture, which only the merge settles.
    merged?: readonly RosterJoin[]
  }
  projectRoot: string | null | undefined
}

async function applyJoins(rows: SessionRosterRow[], joins: readonly RosterJoin[] = []) {
  let joined = rows
  for (const join of joins) joined = await join(joined)
  return joined
}

export async function discoverRoster(step: RosterDiscovery): Promise<TranscriptDiscovery> {
  const observed = await applyJoins(step.discovery.rows, step.joins.observed)
  const roster = mergeManagedRoster({ ...step.discovery, rows: observed }, step.managed)
  const rows = await applyJoins(roster.rows, step.joins.merged)
  // Project scope applies here, at each adapter's own discovery boundary (#2239), rather than
  // after the shared reader has already merged every adapter's machine-wide list.
  const projectRoots = await projectRootsOf(step.projectRoot)
  return { ...roster, rows: rows.filter((row) => belongsToProject(row.cwd, projectRoots)) }
}
