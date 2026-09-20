import { z } from 'zod'

export const CODEX_MODELS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.3-codex-spark',
] as const
export const CODEX_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const
export const CODEX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const

const effortsByModel = {
  'gpt-5.6-sol': CODEX_EFFORTS,
  'gpt-5.6-terra': CODEX_EFFORTS,
  'gpt-5.6-luna': ['low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-5.5': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.3-codex-spark': ['low', 'medium', 'high', 'xhigh'],
} as const satisfies Record<
  (typeof CODEX_MODELS)[number],
  readonly (typeof CODEX_EFFORTS)[number][]
>

const codexSelectedTurnSetupSchema = z
  .strictObject({
    model: z.enum(CODEX_MODELS),
    effort: z.enum(CODEX_EFFORTS),
    mode: z.enum(CODEX_MODES),
  })
  .refine(
    ({ model, effort }) =>
      (effortsByModel[model] as readonly (typeof CODEX_EFFORTS)[number][]).includes(effort),
    {
      message: 'The selected Codex model does not support that effort.',
      path: ['effort'],
    },
  )
export const codexTurnSetupSchema = z.union([z.undefined(), codexSelectedTurnSetupSchema])
export type CodexTurnSetup = z.infer<typeof codexSelectedTurnSetupSchema>
export const CODEX_OPENING_SETUP: CodexTurnSetup = {
  model: 'gpt-5.6-sol',
  effort: 'low',
  mode: 'workspace-write',
}

export function codexEfforts(model: CodexTurnSetup['model']) {
  return effortsByModel[model]
}

export function codexTurnSettings(setup: CodexTurnSetup) {
  const mode = {
    'read-only': { approvalPolicy: 'on-request', sandboxPolicy: { type: 'readOnly' } },
    'workspace-write': { approvalPolicy: 'on-request', sandboxPolicy: { type: 'workspaceWrite' } },
    'danger-full-access': { approvalPolicy: 'never', sandboxPolicy: { type: 'dangerFullAccess' } },
  } as const
  return { model: setup.model, effort: setup.effort, ...mode[setup.mode] }
}
