// The stdin/stdout half of a hook, shared by the guards in this directory and by the task-list nudge.
// Each hook keeps its own pure decide(); this is the plumbing around it.
import { execFileSync } from 'node:child_process'

/** What a harness pipes in. Claude spells the keys one way and Codex the other, so both are
 * optional here and `toolCall` below is the one place that picks. */
export type HookPayload = {
  tool_name?: string
  toolName?: string
  tool_input?: Record<string, unknown>
  toolInput?: Record<string, unknown>
  transcript_path?: string
  prompt?: string
  cwd?: string
  hook_event_name?: string
  hookEventName?: string
  [key: string]: unknown
}

/** One tool call, in the single shape every guard here reasons about. */
export type ToolCall = {
  toolName: string | undefined
  toolInput: Record<string, unknown>
}

/** What a guard says about one tool call. */
export type Verdict = { block: boolean; reason?: string }

/** Where that descriptor lives. CLAUDE_PROJECT_DIR when the harness sets one, else the repo
 * toplevel, so the same script registers under Codex without a rewrite. */
export function resolveProjectDir(cwd: string): string {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()
  } catch {
    return cwd
  }
}

/** The verdict a guard returns when it has nothing to say. */
export const ALLOW: Verdict = { block: false }

/** True when a tool call is an agent's rather than the human's — guards never touch the human.
 * The marker is Claude's own CLAUDECODE, or the ARGO_HOOK_AGENT the projection injects for
 * markerless harnesses (Codex). */
export const underAgent = () => Boolean(process.env.CLAUDECODE || process.env.ARGO_HOOK_AGENT)

/** The tool call a payload names, in one shape. Claude sends tool_name/tool_input; Codex sends
 * toolName/toolInput. Shared because every guard here normalises the same two spellings, and a
 * per-hook copy is a per-hook chance to normalise only one of them. */
export const toolCall = (payload: HookPayload): ToolCall => ({
  toolName: payload.tool_name ?? payload.toolName,
  toolInput: payload.tool_input ?? payload.toolInput ?? {},
})

/** The hook payload the harness pipes in, as text. Exported: every hook here reads the same one. */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Run one guard end to end. Never throws and never exits non-zero — a guard that wedges the
 * session is worse than the mistake it was watching for — so a bad payload OR a decide() that
 * throws both fail open.
 */
export async function runGuard(
  decideFromPayload: (payload: HookPayload) => Verdict,
): Promise<never> {
  let decision: Verdict = { block: false }
  try {
    decision = decideFromPayload(JSON.parse((await readStdin()) || '{}'))
  } catch {
    // Malformed payload, or a guard that threw — fail open.
  }

  if (decision.block) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: decision.reason,
        },
      }),
    )
  }
  process.exit(0)
}
