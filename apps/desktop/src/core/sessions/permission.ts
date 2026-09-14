// The CLI-neutral Permission every SessionDriveAdapter answers in (ADR-0024, #2076). A Permission
// states only what shared code needs to know a pending one exists and describe it; a tool call's
// own vocabulary (Claude's `toolName`/`input`, Codex's `itemId`/request kind) stays behind each
// adapter's own seam and never reaches this type.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'

export const permissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  description: z.string(),
})
export type Permission = z.infer<typeof permissionSchema>

// Every decision word any adapter's Permission can answer with. Claude's PreToolUse hook only
// ever returns two; `allowForSession` and `cancel` exist for Codex's app-server (#1841), which
// joins a standing allow and an interrupt to its two approval decisions respectively.
export const PERMISSION_DECISIONS = ['allow', 'deny', 'allowForSession', 'cancel'] as const
export type PermissionDecision = (typeof PERMISSION_DECISIONS)[number]

// Which of the four words each CLI's Permission actually answers with, so a decision word one CLI
// needs but another doesn't stays representable rather than silently unsupported.
export const PERMISSION_DECISIONS_BY_CLI: Record<string, readonly PermissionDecision[]> = {
  claude: ['allow', 'deny'],
  codex: ['allow', 'deny', 'allowForSession', 'cancel'],
}
