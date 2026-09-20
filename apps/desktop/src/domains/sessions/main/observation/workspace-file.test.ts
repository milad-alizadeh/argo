import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileInWorkspace } from '@/domains/sessions/main/observation/workspace-file'

const WORKSPACE = '/work/argo'

test('a relative path reads inside the workspace', () => {
  assert.equal(fileInWorkspace(WORKSPACE, 'docs/report.md'), '/work/argo/docs/report.md')
})

test('an absolute path inside the workspace reads as itself', () => {
  assert.equal(fileInWorkspace(WORKSPACE, '/work/argo/docs/report.md'), '/work/argo/docs/report.md')
})

test('a path that leaves the workspace reads as nothing', () => {
  for (const outside of ['../secrets', '/work/other/file.md', '/etc/passwd', 'docs/../../x'])
    assert.equal(fileInWorkspace(WORKSPACE, outside), null, outside)
})
