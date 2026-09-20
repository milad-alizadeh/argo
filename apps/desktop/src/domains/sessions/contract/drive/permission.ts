// The Harness-neutral Permission every SessionDriveAdapter answers in (ADR-0024, #2076). A Permission
// states only what shared code needs to know a pending one exists and describe it; a tool call's
// own vocabulary (Claude's `toolName`/`input`, Codex's `itemId`/request kind) stays behind each
// adapter's own seam and never reaches this type.
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const permissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  description: z.string(),
})
export type Permission = z.infer<typeof permissionSchema>

// The decisions the reader can make on a Permission. `allowForSession` is a standing allow that
// Argo holds (ADR-0024, the desktop standing allow): Claude's gate keeps it as a rule for similar calls.
export const READER_DECISIONS = ['allow', 'deny', 'allowForSession'] as const

// Every decision word any adapter's Permission can answer with. `cancel` exists for Codex alone,
// which joins an interrupt to its approvals (#1841).
export const PERMISSION_DECISIONS = [...READER_DECISIONS, 'cancel'] as const
export type PermissionDecision = (typeof PERMISSION_DECISIONS)[number]

// Which of the four words each Harness's Permission actually answers with, so a decision word one Harness
// needs but another doesn't stays representable rather than silently unsupported.
export const PERMISSION_DECISIONS_BY_CLI: Record<string, readonly PermissionDecision[]> = {
  claude: READER_DECISIONS,
  codex: ['allow', 'deny', 'allowForSession', 'cancel'],
}
