import assert from 'node:assert/strict'
import { test } from 'node:test'
import { helloWorldRepository } from '@/mocks/tickets/provider-inputs'
import {
  longBacklog,
  octocat,
  prototype,
  readPath,
  standalone,
  wayfinder,
} from '@/mocks/tickets/renderer-models'
import { exampleIssue, githubStatuses, HELLO_WORLD, octocatUser } from '@/mocks/tickets/scenario'

test('story tickets and the provider repository share one example', () => {
  const issue = exampleIssue(607)
  const ticket = wayfinder()
  const repository = helloWorldRepository()
  const stored = repository.issues.find((item) => item.number === issue.number)
  assert.equal(ticket.title, issue.title)
  assert.equal(ticket.key, `#${issue.number}`)
  assert.equal(ticket.url, `https://github.com/${HELLO_WORLD}/issues/${issue.number}`)
  assert.equal(repository.fullName, HELLO_WORLD)
  assert.equal(stored?.title, issue.title)
  assert.equal(prototype().title, exampleIssue(609).title)
  assert.equal(readPath().title, exampleIssue(388).title)
  assert.equal(standalone().title, exampleIssue(273).title)
  assert.equal(wayfinder().children?.[0]?.title, exampleIssue(609).title)
  assert.equal(octocat().id, `github:${octocatUser().id}`)
  assert.equal(octocat().login, octocatUser().login)
  assert.equal(repository.visibleTo[0], octocatUser().id)
  assert.deepEqual(
    ticket.status,
    githubStatuses().find((status) => status.id === 'open'),
  )
})

test('builders return a fresh copy each call', () => {
  const first = wayfinder()
  const second = wayfinder()
  assert.notEqual(first, second)
  assert.notEqual(first.labels, second.labels)
  assert.notEqual(first.children, second.children)
  assert.deepEqual(first, second)
  const repositories = [helloWorldRepository(), helloWorldRepository()]
  assert.notEqual(repositories[0], repositories[1])
  assert.notEqual(repositories[0]?.issues, repositories[1]?.issues)
  assert.deepEqual(repositories[0], repositories[1])
  const users = [octocatUser(), octocatUser()]
  assert.notEqual(users[0], users[1])
  assert.deepEqual(users[0], users[1])
  const backlog = longBacklog(2)
  assert.notEqual(backlog[0]?.children, backlog[1]?.children)
  assert.notEqual(backlog[0]?.blockedBy, backlog[1]?.blockedBy)
  assert.notEqual(backlog[0]?.status, backlog[1]?.status)
})
