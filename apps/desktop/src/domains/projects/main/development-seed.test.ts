import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectStore } from '@/domains/accounts/main/harness-fixtures'
import { selectDevelopmentProject } from '@/domains/projects/main/development-seed'
import type { ProjectRegistry } from '@/domains/projects/main/sqlite-store'

function store(initial: ProjectRegistry) {
  const projects = projectStore('project-fixture')
  projects.replace(initial)
  return projects
}

test('registers and selects the development worktree on first launch', () => {
  const projects = store({ projects: [], selectedId: null })

  selectDevelopmentProject(projects, {
    path: '/worktrees/ticket-2391',
    commonDirectory: '/repositories/argo/.git',
  })

  const registry = projects.read()
  assert.equal(registry.selectedId, registry.projects[0]?.id)
  assert.deepEqual(registry.projects[0], {
    id: registry.projects[0]?.id,
    path: '/worktrees/ticket-2391',
    commonDirectory: '/repositories/argo/.git',
  })
})

test('keeps the Project identity and connection when a different worktree opens it', () => {
  const projects = store({
    projects: [
      {
        id: 'project-argo',
        path: '/worktrees/ticket-2304',
        commonDirectory: '/repositories/argo/.git',
      },
    ],
    selectedId: null,
  })

  selectDevelopmentProject(projects, {
    path: '/worktrees/ticket-2391',
    commonDirectory: '/repositories/argo/.git',
  })

  assert.deepEqual(projects.read(), {
    projects: [
      {
        id: 'project-argo',
        path: '/worktrees/ticket-2391',
        commonDirectory: '/repositories/argo/.git',
      },
    ],
    selectedId: 'project-argo',
  })
})
