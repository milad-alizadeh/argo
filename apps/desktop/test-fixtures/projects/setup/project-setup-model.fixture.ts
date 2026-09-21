import type { ProjectSetupEvent } from '@/domains/projects/main/setup/project-setup-machine-types'
import { acceptedPlanFixture, planFixture } from './setup-plan.fixture'

const plan = planFixture()

export const projectSetupModelEvents: ProjectSetupEvent[] = [
  { type: 'Choose manual' },
  { type: 'Choose agent', harness: 'claude' },
  { type: 'Planning session started', sessionId: 'planning-session' },
  {
    type: 'Questions received',
    questions: [
      {
        id: 'package-manager',
        prompt: 'Package manager?',
        suggestions: ['Bun', 'pnpm', 'npm'],
        recommended: 'Bun',
      },
    ],
  },
  {
    type: 'Answers sent',
    answers: [{ id: 'package-manager', selections: ['Bun'], custom: '' }],
  },
  { type: 'Plan validated', plan },
  { type: 'Invalid output', issues: ['The result did not match the schema.'] },
  { type: 'Request plan change', feedback: 'Revise the plan.' },
  { type: 'Continue plan review' },
  { type: 'Select application harness', harness: 'claude' },
  { type: 'Accept plan', acceptedPlan: acceptedPlanFixture(plan) },
  { type: 'Application session started', sessionId: 'application-session' },
  {
    type: 'Progress received',
    progress: [{ stepId: 'inspect', status: 'running', message: 'Inspecting.' }],
  },
  { type: 'Application completed', finalDiff: 'diff', progress: [] },
  {
    type: 'Application drift',
    reason: 'application-drift',
    finalDiff: 'diff --git a/package.json b/package.json\n@@ -1 +1 @@\n-old\n+new',
  },
  { type: 'Effect interrupted', reason: 'interrupted' },
  { type: 'Resume planning' },
  { type: 'Resume application' },
  { type: 'Restart attempt' },
  { type: 'Defer' },
  { type: 'Back' },
  { type: 'Save manual', source: '{"version":1}' },
  { type: 'Resume setup' },
  { type: 'Edit setup' },
  { type: 'Approve final diff' },
  { type: 'Request application change', feedback: 'Adjust the setup changes.' },
  { type: 'Cancel setup requested' },
  { type: 'Retry cancel' },
  {
    type: 'Permission requested',
    permissionId: 'permission-1',
    description: 'Read files.',
  },
  { type: 'Approve effect' },
  { type: 'Reject effect' },
  { type: 'Cancel setup confirmed' },
  { type: 'Cancel setup failed', reason: 'cancel-failed' },
  { type: 'Finalization completed' },
  { type: 'Finalization failed', reason: 'finalization-failed' },
]
