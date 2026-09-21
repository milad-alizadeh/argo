import { planFixture } from '../../../test-fixtures/projects/setup/setup-plan.fixture.ts'

export function projectSetupReply(prompt: string, scenario: string | undefined): string | null {
  if (
    prompt.includes('focused setup questions') ||
    prompt.includes('Revise the plan in response') ||
    prompt.includes('did not match the required schema')
  )
    return readyProjectSetupReply()
  if (prompt.includes('ARGO_SETUP_PLAN')) {
    if (scenario === 'invalid') return 'ARGO_SETUP_PLAN\n```json\n{"status":"unknown"}\n```'
    if (scenario === 'questions')
      return 'ARGO_SETUP_PLAN\n```json\n{"status":"needs-user-input","revision":"plan-1","questions":[{"id":"workspace-shape","prompt":"Which workspaces should be independent Targets?","context":"Two workspaces are runnable.","suggestions":["Desktop app","Website"],"recommended":"Desktop app"}]}\n```'
    return readyProjectSetupReply()
  }
  if (!prompt.includes('ARGO_APPLY_REPORT')) return null
  if (scenario === 'application-failure')
    return 'ARGO_APPLY_REPORT\n```json\n{"outcome":"failed","steps":[]}\n```'
  return 'ARGO_STEP {"stepId":"verify-desktop-test","status":"passed","message":"Setup verified."}\nARGO_APPLY_REPORT\n```json\n{"outcome":"completed","steps":[{"stepId":"verify-desktop-test","status":"passed","message":"Setup verified."}]}\n```'
}

function readyProjectSetupReply(): string {
  const plan = planFixture({
    source: {
      ...planFixture().source,
      projectRoot: process.cwd(),
      fingerprints: {},
    },
  })
  return `ARGO_STEP {"stepId":"inspect-project","status":"passed","message":"Project inspected."}\nARGO_SETUP_PLAN\n\`\`\`json\n${JSON.stringify({ status: 'ready-for-review', revision: plan.source.planRevision, plan })}\n\`\`\``
}
