import { describe, expect, it } from 'vitest'
import { type WorkItemView, workItemView } from '../workItems/model'
import { replay } from './__fixtures__/projection'
import { emptyState } from './cockpitState'
import { applyEvent, type HubEvent } from './projection'

// Seam A for the Work Item provider port: `work-items-synced` in, projected backlog out, and
// the renderer's replay of the same delta landing on identical state (ADR-0005).

const argoItem = (id: string): WorkItemView => workItemView({ id, projectId: 'p-argo' })
const shopItem = (id: string): WorkItemView => workItemView({ id, projectId: 'p-shop' })

function synced(projectId: string, items: WorkItemView[]): HubEvent {
  return { type: 'work-items-synced', projectId, items }
}

describe('syncing a backlog', () => {
  it('projects the items a poll read', () => {
    const { projected } = replay([synced('p-argo', [argoItem('github:1')])])
    expect(projected.workItems.map((item) => item.id)).toEqual(['github:1'])
  })

  it('replaces the Project slice wholesale, so a deleted ticket disappears', () => {
    // Read-through data has no patch vocabulary: the provider's list IS the answer, and an
    // item it stopped returning is one the user no longer has.
    const { projected } = replay([
      synced('p-argo', [argoItem('github:1'), argoItem('github:2')]),
      synced('p-argo', [argoItem('github:2')]),
    ])
    expect(projected.workItems.map((item) => item.id)).toEqual(['github:2'])
  })

  it('leaves another Project backlog untouched', () => {
    const { projected } = replay([
      synced('p-shop', [shopItem('github:9')]),
      synced('p-argo', [argoItem('github:1')]),
    ])
    expect(projected.workItems.map((item) => item.projectId).sort()).toEqual(['p-argo', 'p-shop'])
  })

  it('preserves the order the port returned, which is the provider author order', () => {
    const { projected } = replay([
      synced('p-argo', [argoItem('github:3'), argoItem('github:1'), argoItem('github:2')]),
    ])
    expect(projected.workItems.map((item) => item.id)).toEqual(['github:3', 'github:1', 'github:2'])
  })
})

describe('a poll that found nothing new', () => {
  it('broadcasts no delta at all', () => {
    // The poller re-reads the identical list every interval; only the reducer can tell, and a
    // fresh state reference would re-render the whole Work room on a quiet backlog.
    let state = emptyState()
    state = applyEvent(state, synced('p-argo', [argoItem('github:1')])).state
    expect(applyEvent(state, synced('p-argo', [argoItem('github:1')])).deltas).toEqual([])
  })

  it('returns the same state reference', () => {
    const state = applyEvent(emptyState(), synced('p-argo', [argoItem('github:1')])).state
    expect(applyEvent(state, synced('p-argo', [argoItem('github:1')])).state).toBe(state)
  })

  it('does emit when an item changed under the same id', () => {
    const first = workItemView({ id: 'github:1', projectId: 'p-argo', title: 'Before' })
    const second = workItemView({ id: 'github:1', projectId: 'p-argo', title: 'After' })
    const state = applyEvent(emptyState(), synced('p-argo', [first])).state
    expect(applyEvent(state, synced('p-argo', [second])).deltas).toHaveLength(1)
  })
})

describe('the two copies agree', () => {
  it('projects renderer-side onto the same state main holds', () => {
    const { hub, projected } = replay([
      synced('p-argo', [argoItem('github:1'), argoItem('github:2')]),
      synced('p-shop', [shopItem('github:9')]),
      synced('p-argo', [argoItem('github:2')]),
    ])
    expect(projected).toEqual(hub)
  })
})
