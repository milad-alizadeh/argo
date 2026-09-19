// The Linear teams an Account can read, and whether it can read one. A team is the scope of a Linear
// Connection, checked when the Connection is made (ADR-0018).

import type { LinearEndpoints } from '@/providers/linear/endpoints'
import { failed, type LinearFailure, type LinearRead, query } from '@/providers/linear/http'
import { isIdentifier, isRecord } from '@/shared/validation'

export type Team = { id: string; key: string; name: string }

// Linear's page ceiling is 250; the page limit is a backstop so a runaway listing cannot walk forever.
const PAGE_SIZE = 100
const PAGE_LIMIT = 20

const TEAMS = `query Teams($first: Int!, $after: String) {
  teams(first: $first, after: $after) { pageInfo { hasNextPage endCursor } nodes { id key name } }
}`

function team(value: unknown): Team | null {
  if (!isRecord(value) || !isIdentifier(value.id)) return null
  if (typeof value.key !== 'string' || typeof value.name !== 'string') return null
  return { id: value.id, key: value.key, name: value.name }
}

// Every team the Account can see, in Linear's order.
export async function listTeams(
  endpoints: LinearEndpoints,
  token: string,
): Promise<LinearRead<Team[]>> {
  const teams: Team[] = []
  let after: string | null = null
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const reply = await query({ endpoints, token }, TEAMS, { first: PAGE_SIZE, after })
    if (!reply.ok) return reply
    const connection = reply.value.teams
    if (!isRecord(connection) || !Array.isArray(connection.nodes)) return failed('unreachable')
    teams.push(...connection.nodes.map(team).filter((entry) => entry !== null))
    const info = connection.pageInfo
    if (!isRecord(info) || info.hasNextPage !== true || typeof info.endCursor !== 'string') break
    after = info.endCursor
  }
  return { ok: true, value: teams }
}

export type TeamCheck =
  | { ok: true; team: Team }
  | { ok: false; failure: LinearFailure | 'team-not-visible' }

// Read through the listing rather than `team(id:)`, whose refusal for a team out of sight carries no
// code that tells it apart from any other error.
export async function checkTeam(
  endpoints: LinearEndpoints,
  token: string,
  teamId: string,
): Promise<TeamCheck> {
  const teams = await listTeams(endpoints, token)
  if (!teams.ok) return teams
  const found = teams.value.find((candidate) => candidate.id === teamId)
  return found ? { ok: true, team: found } : { ok: false, failure: 'team-not-visible' }
}
