import { afterEach, describe, test } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileInWorkspace, readFileInWorkspace, skillFileContent } from './session-file-reads'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

async function scratch() {
  const directory = await mkdtemp(path.join(tmpdir(), 'argo-file-reads-'))
  directories.push(directory)
  return directory
}

describe('session file reads', () => {
  test('a workspace file stays inside the session directory', async () => {
    const root = await scratch()
    const workspace = path.join(root, 'workspace')
    const inside = path.join(workspace, 'src', 'note.txt')
    await mkdir(path.dirname(inside), { recursive: true })
    await writeFile(inside, 'inside')
    assert.equal(fileInWorkspace(workspace, 'src/note.txt'), inside)
    assert.equal(fileInWorkspace(workspace, '../outside.txt'), null)
    const outside = path.join(root, 'secret.txt')
    await writeFile(outside, 'secret')
    await symlink(outside, path.join(workspace, 'linked.txt'))
    assert.equal(await readFileInWorkspace(workspace, 'src/note.txt'), 'inside')
    assert.equal(await readFileInWorkspace(workspace, 'linked.txt'), null)
  })

  test('a skill read returns only a real SKILL.md', async () => {
    const directory = await scratch()
    const skill = path.join(directory, 'SKILL.md')
    const other = path.join(directory, 'README.md')
    await writeFile(skill, '---\nname: demo\n---\nbody')
    await writeFile(other, 'nope')
    const linked = path.join(directory, 'linked', 'SKILL.md')
    await mkdir(path.dirname(linked), { recursive: true })
    await symlink(skill, linked)
    assert.equal(await skillFileContent(skill), '---\nname: demo\n---\nbody')
    assert.equal(await skillFileContent(other), null)
    assert.equal(await skillFileContent('SKILL.md'), null)
    assert.equal(await skillFileContent(linked), '---\nname: demo\n---\nbody')
  })
})
