export function findsCycle(
  ids: Set<string>,
  prerequisitesOf: Map<string, string[]>,
): string | null {
  const state = new Map<string, 'visiting' | 'done'>()
  for (const id of ids) {
    const cycle = visit({ id, path: [], state, prerequisitesOf })
    if (cycle) return cycle
  }
  return null
}

function visit({
  id,
  path,
  state,
  prerequisitesOf,
}: {
  id: string
  path: string[]
  state: Map<string, 'visiting' | 'done'>
  prerequisitesOf: Map<string, string[]>
}): string | null {
  const status = state.get(id)
  if (status === 'done') return null
  if (status === 'visiting') return [...path, id].join(' -> ')
  state.set(id, 'visiting')
  for (const prerequisite of prerequisitesOf.get(id) ?? []) {
    const cycle = visit({ id: prerequisite, path: [...path, id], state, prerequisitesOf })
    if (cycle) return cycle
  }
  state.set(id, 'done')
  return null
}
