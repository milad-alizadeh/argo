import type { FileDiff } from '@/platform/renderer/components/file-diff-list'
import type { OnboardingController, OnboardingTarget } from './project-onboarding'

export function setupDiffFiles(state: OnboardingController['state']): FileDiff[] {
  const ids = new Set(
    state.repositoryRecommendations.filter(({ accepted }) => accepted).map(({ id }) => id),
  )
  const dependencies = state.targets.flatMap((target) =>
    target.recommendations
      .filter(({ accepted }) => accepted)
      .flatMap(({ bundledDependencies = [] }) => bundledDependencies),
  )
  const files: FileDiff[] = [
    { path: '.argo/settings.json', diff: setupSettingsDiff(state.targets) },
  ]
  if (dependencies.length) files.push(packageDependenciesDiff(dependencies))
  addRepositoryDiffs(files, ids)
  return files
}

function addRepositoryDiffs(files: FileDiff[], ids: Set<string>) {
  if (ids.has('rtk-filters'))
    files.push({
      path: '.rtk/filters.toml',
      diff: '@@ -1,2 +1,5 @@\n [filters]\n bun = "errors-and-summary"\n+test = "failures-and-summary"\n+typecheck = "diagnostics"\n+build = "errors-and-summary"',
    })
  if (ids.has('quality-gates'))
    files.push({
      path: 'biome.jsonc',
      diff: '@@ -8,3 +8,6 @@\n   "linter": {\n-    "enabled": false\n+    "enabled": true,\n+    "rules": {\n+      "recommended": true\n+    }\n   }',
    })
  if (['agent-instructions', 'interface-review', 'agent-doc-audit'].some((id) => ids.has(id)))
    files.push({
      path: 'AGENTS.md',
      diff: '@@ -18,2 +18,6 @@\n ## Agent workflow\n+Track multi-step work with a live task list.\n+Choose a model for every delegated task.\n+Run interface review for UI changes.\n+Audit these instructions after setup.\n ',
    })
  if (ids.has('guardrail-hooks'))
    files.push({
      path: 'hooks.json',
      diff: '@@ -0,0 +1,7 @@\n+{\n+  "worktreeGuard": {\n+    "dir": ".claude/worktrees",\n+    "branchPrefix": "project/"\n+  },\n+  "agents": ["claude-code", "codex"]\n+}',
    })
  if (['argo-skill-bundle', 'matt-pocock', 'writing-skills'].some((id) => ids.has(id)))
    files.push({
      path: 'skills-lock.json',
      diff: '@@ -1,3 +1,8 @@\n {\n+  "argo-skills": "latest",\n+  "engineering-workflows": "latest",\n+  "simple-english": "latest",\n+  "writing-for-agents": "latest",\n   "version": 1\n }',
    })
  if (ids.has('codex-todos'))
    files.push({
      path: '~/.codex/config.toml',
      diff: '@@ -1,2 +1,5 @@\n model = "default"\n+\n+[tools.update_plan]\n+enabled = true\n ',
    })
}

function setupSettingsDiff(targets: OnboardingTarget[]) {
  const targetLines = targets.flatMap((target, index) => [
    `+    "${target.id}": {`,
    `+      "path": "${target.path}",`,
    `+      "start": "${target.startCommand}"`,
    `+    }${index === targets.length - 1 ? '' : ','}`,
  ])
  return [
    '@@ -0,0 +1,12 @@',
    '+{',
    '+  "version": 1,',
    '+  "targets": {',
    ...targetLines,
    '+  }',
    '+}',
  ].join('\n')
}
function packageDependenciesDiff(dependencies: string[]): FileDiff {
  const uniqueDependencies = [...new Set(dependencies)]
  return {
    path: 'package.json',
    diff: [
      '@@ -12,3 +12,8 @@',
      '   "devDependencies": {',
      ...uniqueDependencies.map(
        (dependency, index) =>
          `+    "${dependency}": "latest"${index === uniqueDependencies.length - 1 ? '' : ','}`,
      ),
      '   }',
    ].join('\n'),
  }
}
