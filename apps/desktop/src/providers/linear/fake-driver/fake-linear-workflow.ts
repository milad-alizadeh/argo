// A fake Linear team's workflow: the states every team keeps, and moving an issue between them.
// Each team's states have ids of their own, so a state of another team is refused as Linear does.
import type { FakeLinearIssue, FakeLinearTeam } from './fake-linear'
import type { FakeLinearState } from './fake-linear-state'

type StateType = NonNullable<FakeLinearIssue['stateType']>

const WORKFLOW: { name: string; type: StateType }[] = [
  { name: 'Backlog', type: 'backlog' },
  { name: 'Todo', type: 'unstarted' },
  { name: 'In Progress', type: 'started' },
  { name: 'Done', type: 'completed' },
  { name: 'Canceled', type: 'canceled' },
]

const stateId = (team: FakeLinearTeam, name: string) =>
  `${team.id}-${name.toLowerCase().replaceAll(' ', '-')}`

export const teamStates = (team: FakeLinearTeam) =>
  WORKFLOW.map((state, position) => ({ id: stateId(team, state.name), ...state, position }))

export function issueState(team: FakeLinearTeam, issue: FakeLinearIssue) {
  const name = issue.status ?? 'Todo'
  return { id: stateId(team, name), name, type: issue.stateType ?? 'unstarted' }
}

export function findIssue(state: FakeLinearState, identifier: string) {
  for (const team of state.teams.values()) {
    const issue = team.issues.find((candidate) => candidate.identifier === identifier)
    if (issue) return { team, issue }
  }
}

// Answers `null` for an issue or a state the move cannot reach.
export function moveIssue(state: FakeLinearState, identifier: string, target: string) {
  const found = findIssue(state, identifier.replace(/^issue-/, ''))
  const next = found && teamStates(found.team).find((candidate) => candidate.id === target)
  if (!(found && next)) return null
  found.issue.status = next.name
  found.issue.stateType = next.type
  return issueState(found.team, found.issue)
}
