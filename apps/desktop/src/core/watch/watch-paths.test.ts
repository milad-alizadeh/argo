import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { watchTrees } from './watch-paths'

const trees: string[] = []

async function tree(name: string) {
  const root = await mkdtemp(path.join(tmpdir(), `argo-watch-${name}-`))
  trees.push(root)
  return root
}

// The settle window is 400ms, so a change is awaited a little past it.
function settled() {
  return new Promise((resolve) => setTimeout(resolve, 900))
}

afterEach(async () => {
  for (const root of trees.splice(0)) await rm(root, { force: true, recursive: true })
})

describe('watching a tree', () => {
  test('reports a file written under the watched root', async () => {
    const root = await tree('written')
    let changes = 0
    const watched = watchTrees([root], () => {
      changes += 1
    })
    await writeFile(path.join(root, 'session.jsonl'), '{}\n')
    await settled()
    watched.close()
    expect(changes).toBe(1)
  })

  test('reports a burst of writes as one change', async () => {
    const root = await tree('burst')
    let changes = 0
    const watched = watchTrees([root], () => {
      changes += 1
    })
    const file = path.join(root, 'session.jsonl')
    for (let index = 0; index < 20; index += 1) await writeFile(file, `{"line":${index}}\n`)
    await settled()
    watched.close()
    expect(changes).toBe(1)
  })

  test('reports nothing after it is closed', async () => {
    const root = await tree('closed')
    let changes = 0
    const watched = watchTrees([root], () => {
      changes += 1
    })
    watched.close()
    await writeFile(path.join(root, 'session.jsonl'), '{}\n')
    await settled()
    expect(changes).toBe(0)
  })

  test('watches the trees that exist when one of them does not', async () => {
    const root = await tree('present')
    let changes = 0
    const watched = watchTrees([path.join(root, 'absent'), root], () => {
      changes += 1
    })
    await writeFile(path.join(root, 'session.jsonl'), '{}\n')
    await settled()
    watched.close()
    expect(changes).toBe(1)
  })
})
