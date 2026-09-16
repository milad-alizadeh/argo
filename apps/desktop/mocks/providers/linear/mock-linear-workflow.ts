// A mock Linear team's workflow: the states every team keeps, and moving an issue between them.
// Each team's states have ids of their own, so a state of another team is refused as Linear does.
import type { MockLinearIssue, MockLinearTeam } from './mock-linear'
import type { MockLinearState } from './mock-linear-state'

type StateType = NonNullable<MockLinearIssue['stateType']>

const WORKFLOW: { name: string; type: StateType }[] = [
  { name: 'Backlog', type: 'backlog' },
  { name: 'Todo', type: 'unstarted' },
  { name: 'In Progress', type: 'started' },
  { name: 'Done', type: 'completed' },
  { name: 'Canceled', type: 'canceled' },
]

const stateId = (team: MockLinearTeam, name: string) =>
  `${team.id}-${name.toLowerCase().replaceAll(' ', '-')}`

export const teamStates = (team: MockLinearTeam) =>
  WORKFLOW.map((state, position) => ({ id: stateId(team, state.name), ...state, position }))

export function issueState(team: MockLinearTeam, issue: MockLinearIssue) {
  const name = issue.status ?? 'Todo'
  return { id: stateId(team, name), name, type: issue.stateType ?? 'unstarted' }
}

export function findIssue(state: MockLinearState, identifier: string) {
  for (const team of state.teams.values()) {
    const issue = team.issues.find((candidate) => candidate.identifier === identifier)
    if (issue) return { team, issue }
  }
}

// Answers `null` for an issue or a state the move cannot reach.
export function moveIssue(state: MockLinearState, identifier: string, target: string) {
  const found = findIssue(state, identifier.replace(/^issue-/, ''))
  const next = found && teamStates(found.team).find((candidate) => candidate.id === target)
  if (!(found && next)) return null
  found.issue.status = next.name
  found.issue.stateType = next.type
  return issueState(found.team, found.issue)
}

// Answers `null` for an issue the write cannot reach.
export function setPriority(state: MockLinearState, identifier: string, priority: number) {
  const found = findIssue(state, identifier.replace(/^issue-/, ''))
  if (!found) return null
  found.issue.priority = priority as MockLinearIssue['priority']
  return found.issue
}
