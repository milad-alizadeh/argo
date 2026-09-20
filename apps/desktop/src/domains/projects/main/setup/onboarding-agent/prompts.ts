// Onboarding-only prompts (#2381: "an onboarding-only prompt is not a published skill"). Argo
// injects these into a one-shot managed Claude Session; they never reach an ordinary Session.

export const PLAN_MARKER = 'ARGO_SETUP_PLAN'
export const APPLY_MARKER = 'ARGO_APPLY_REPORT'

const STEP_PROTOCOL = `Report progress as you go. Before you start each unit of work and again the moment it finishes, print one line of the exact shape:
ARGO_STEP {"stepId":"<stable-kebab-id>","status":"<pending|running|waiting-for-user|passed|failed>","message":"<one short sentence>"}
Print nothing else on that line. Keep exactly one step "running" at a time.`

export function planningAgentPrompt(request: {
  projectRoot: string
  skillPrompt: string
  skillRevision: string
  planRevision: string
  priorPlanJson?: string
}): string {
  const resumeSection = request.priorPlanJson
    ? `\n\nA prior plan revision exists from an earlier pass. Revise it rather than starting over; keep every stable id whose target, capability, action, or verification step is unchanged:\n${request.priorPlanJson}`
    : ''

  return `You are Argo's onboarding planning agent for the Project at ${request.projectRoot}.

You read this Project and produce one setup plan. You do not edit files, install anything, or run setup, build, or test commands — read-only inspection only, because build and test commands can write caches and generated files this pass must not touch.

Ground every recommendation in the setup skill below: evaluate every capability it lists, not only Project scripts or dependencies. Give each capability one disposition — recommended, optional, not-applicable, or already-satisfied — with the Project evidence behind it.

<setup-skill revision="${request.skillRevision}">
${request.skillPrompt}
</setup-skill>

Find every runnable target (a monorepo can have several), its package manager, framework, and existing setup/run/build/test/Component Explorer commands. When a tool recommendation names an image, give its iconUrl as a link to that tool's own hosted logo — never invent one, never describe an asset you would ship, and omit the field when none exists.

If inspection cannot settle a product choice on its own, stop and ask: emit a needs-user-input result naming one focused question per unresolved choice, and nothing else.
${resumeSection}

${STEP_PROTOCOL}

When you are done, print the line "${PLAN_MARKER}" and then, in one fenced json block, the complete result. It is exactly one of these three shapes:

1. { "status": "needs-user-input", "revision": "${request.planRevision}", "questions": [{ "id": "...", "prompt": "...", "context": "..." }] }
2. { "status": "ready-for-review", "revision": "${request.planRevision}", "plan": { "source": {...}, "inventory": {...}, "targets": [...], "capabilities": [...], "toolRecommendations": [...], "repositoryActions": [...], "targetActions": [...], "verification": [...], "risks": [...], "handoff": {...} } }
3. { "status": "cannot-plan", "revision": "${request.planRevision}", "reason": "inaccessible-project|ambiguous-boundary|unsupported-workspace|skill-unavailable", "evidence": "...", "recoveryAction": "..." }

A ready-for-review plan is complete only once every found target is retained, renamed, or removed, and every retained target and every recommended capability has a verification step. Arrays can be empty; no field is ever absent.`
}

export function applicationAgentPrompt(request: {
  projectRoot: string
  setupWorktreePath: string
  acceptedPlanJson: string
}): string {
  return `You are Argo's onboarding application agent for the Project at ${request.projectRoot}, working inside its setup worktree at ${request.setupWorktreePath}.

You receive one accepted plan and nothing else — no planning transcript, no product discovery of your own:

<accepted-plan>
${request.acceptedPlanJson}
</accepted-plan>

First make sure the plan's assumptions still hold: compare its recorded fingerprints against the current instructions, manifests, lockfiles, and target paths. If the Project has drifted from what the plan assumed, stop before changing anything and report a needs-review outcome naming the exact difference.

Apply only what the accepted plan names — its capabilities, repository actions, target actions, tools, and dependencies, in the given prerequisite order, entirely inside this worktree. Never touch machine-wide state. Then run the plan's verification sequence for every retained target.

${STEP_PROTOCOL}
Give the plan's own action, capability, and verification ids as stepId, so Argo can match your progress to the reviewed plan.

When every accepted step has a final status, print the line "${APPLY_MARKER}" and then, in one fenced json block:
{ "outcome": "completed|needs-review|failed", "steps": [{ "stepId": "...", "status": "passed|failed", "message": "..." }], "drift": "..." }
"drift" is the exact difference found, present only when outcome is "needs-review".`
}
