// Provider mock inputs for the Tickets example. Each call returns a new repository.
import type { MockIssue, MockRepository } from '@/mocks/providers/github/mock-github'
import {
  ENGINE_REPOSITORY,
  type ExampleIssue,
  exampleIssues,
  HELLO_WORLD,
  hubotUser,
  octocatUser,
  SECRET_REPOSITORY,
} from '@/mocks/tickets/scenario'

function mockIssue(issue: ExampleIssue): MockIssue {
  return {
    number: issue.number,
    title: issue.title,
    ...(issue.body === undefined ? {} : { body: issue.body }),
    ...(issue.state === undefined ? {} : { state: issue.state }),
    ...(issue.labels === undefined ? {} : { labels: issue.labels }),
    ...(issue.type === undefined ? {} : { type: issue.type }),
    ...(issue.children === undefined ? {} : { children: issue.children }),
    ...(issue.blockedBy === undefined ? {} : { blockedBy: issue.blockedBy }),
    ...(issue.pullRequest === undefined ? {} : { pullRequest: issue.pullRequest }),
  }
}

export function helloWorldRepository(): MockRepository {
  const octocat = octocatUser()
  const hubot = hubotUser()
  return {
    fullName: HELLO_WORLD,
    visibleTo: [octocat.id, hubot.id],
    issues: exampleIssues().map(mockIssue),
  }
}

export function secretRepository(): MockRepository {
  return { fullName: SECRET_REPOSITORY, visibleTo: [], issues: [] }
}

export function engineRepository(): MockRepository {
  return {
    fullName: ENGINE_REPOSITORY,
    visibleTo: [octocatUser().id],
    issues: [{ number: 5, title: 'Tune the engine' }],
  }
}

export { hubotUser, octocatUser }
