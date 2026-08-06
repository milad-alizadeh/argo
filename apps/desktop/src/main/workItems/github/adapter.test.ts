import { describe, expect, it } from 'vitest'
import { API_BASE, OWNER, REPOSITORY } from '../__fixtures__/fakeGitHub'
import { gitHubPort, OPEN_ISSUE as open, readItems, readPort } from '../__fixtures__/gitHubPort'

// The Work Item provider port, exercised THROUGH the canonical interface against a fake HTTP
// layer — never around it. Every assertion below is about what `read()` returns, so the suite
// survives a rewrite of everything under it and would still catch the adapter lying.
// The hierarchy and `blockedBy` halves of the same contract live in `adapterJoins.test.ts`.

describe('the two words', () => {
  it('carries the provider word verbatim beside the canonical bucket', async () => {
    const [item] = await readItems({ issues: [open] })
    expect(item?.status).toEqual({ word: 'open', bucket: 'todo' })
  })

  it('never replaces the provider word with the bucket', async () => {
    // The whole #167 discipline: GitHub says `open`, and Argo showing its own `todo` there
    // would overwrite what the provider actually said.
    const [item] = await readItems({ issues: [open] })
    expect(item?.status.word).not.toBe(item?.status.bucket)
  })
})

describe('done and closed stay distinct', () => {
  it('reads a completed closure as done', async () => {
    const [item] = await readItems({
      issues: [{ ...open, state: 'closed', state_reason: 'completed' }],
    })
    expect(item?.status.bucket).toBe('done')
  })

  it('reads an abandoned closure as closed', async () => {
    const [item] = await readItems({
      issues: [{ ...open, state: 'closed', state_reason: 'not_planned' }],
    })
    expect(item?.status.bucket).toBe('closed')
  })

  it('reads a closure whose kind is unreadable as done rather than abandoned', async () => {
    // Degrading the other way would strand every dependent of an old issue closed before
    // GitHub carried a reason at all.
    const [item] = await readItems({ issues: [{ ...open, state: 'closed', state_reason: null }] })
    expect(item?.status.bucket).toBe('done')
  })

  it('keeps the provider word identical across both closures', async () => {
    const [done] = await readItems({
      issues: [{ ...open, state: 'closed', state_reason: 'completed' }],
    })
    const [closed] = await readItems({
      issues: [{ ...open, state: 'closed', state_reason: 'not_planned' }],
    })
    expect(done?.status.word).toBe('closed')
    expect(closed?.status.word).toBe('closed')
  })
})

describe('the declared degradation tier', () => {
  it('declares GitHub Issues a bare tracker with native closure', () => {
    expect(gitHubPort({ issues: [] }).provider.capabilities()).toEqual({
      canAssign: true,
      canComment: true,
      closureKind: 'native',
      tier: 'bare',
    })
  })

  it('never produces the middle buckets a bare tracker cannot carry', async () => {
    const backlog = await readItems({
      issues: [open, { ...open, id: 1002, number: 13, title: 'In flight' }],
    })
    expect(backlog.map((item) => item.status.bucket)).toEqual(['todo', 'todo'])
  })
})

describe('what a read is and is not', () => {
  it('leaves pull requests out of the backlog', async () => {
    const backlog = await readItems({
      issues: [open, { ...open, id: 1009, number: 99, title: 'A PR', pull_request: {} }],
    })
    expect(backlog.map((item) => item.reference)).toEqual(['#12'])
  })

  it('reports the provider refusal verbatim rather than an empty backlog', async () => {
    const result = await readPort({
      issues: [open],
      refuse: { fragment: '/issues?', status: 401, message: 'Bad credentials' },
    })
    expect(result).toEqual({ ok: false, detail: 'Bad credentials', reason: 'rejected' })
  })

  it('stamps every item with the Project whose backlog it is', async () => {
    const backlog = await readItems({ issues: [open] })
    expect(backlog[0]?.projectId).toBe('p-argo')
  })

  it('reaches the provider over HTTP with the grant, and never shells out', async () => {
    const { provider, github } = gitHubPort({ issues: [open] })
    await provider.read()
    expect(github.requests[0]?.url).toBe(
      `${API_BASE}/repos/${OWNER}/${REPOSITORY}/issues?state=all&per_page=100`,
    )
    expect(github.requests[0]?.headers.authorization).toBe('Bearer gho_test')
  })
})
