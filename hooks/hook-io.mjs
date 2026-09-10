// The stdin/stdout half of a hook, shared by the guards in this directory and by the task-list nudge.
// Each hook keeps its own pure decide(); this is the plumbing around it.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** One guard's own configuration block, read from the descriptor that travels with the hooks.
 * Shared, because three guards now read a top-level block out of the same file, and a copy of
 * this reader per guard is a place for the key names to drift. Missing or malformed reads as
 * `{}`, the unconfigured default every consumer starts on. */
export function readGuardConfig(root, key) {
  const descriptor = path.join(root, 'hooks.json')
  if (!existsSync(descriptor)) return {}
  try {
    return JSON.parse(readFileSync(descriptor, 'utf8'))[key] ?? {}
  } catch {
    return {}
  }
}

/** The `worktreeGuard` block, which two guards answer to. */
export const readWorktreeGuard = (root) => readGuardConfig(root, 'worktreeGuard')

/** Where that descriptor lives. CLAUDE_PROJECT_DIR when the harness sets one, else the repo
 * toplevel, so the same script registers under Codex without a rewrite. */
export function resolveProjectDir(cwd) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()
  } catch {
    return cwd
  }
}

/** The verdict a guard returns when it has nothing to say. Every guard here needs it, and
 * a literal in three call sites is one paste past the rule. */
export const ALLOW = { block: false }

/** True when a tool call is an agent's rather than the human's — guards never touch the human.
 * The marker is Claude's own CLAUDECODE, or the ARGO_HOOK_AGENT the projection injects for
 * markerless harnesses (Codex). */
export const underAgent = () => Boolean(process.env.CLAUDECODE || process.env.ARGO_HOOK_AGENT)

/** The tool call a payload names, in one shape. Claude sends tool_name/tool_input; Codex sends
 * toolName/toolInput. Shared because every guard here normalises the same two spellings, and a
 * per-hook copy is a per-hook chance to normalise only one of them. */
export const toolCall = (payload) => ({
  toolName: payload.tool_name ?? payload.toolName,
  toolInput: payload.tool_input ?? payload.toolInput ?? {},
})

/** The hook payload the harness pipes in, as text. Exported: every hook here reads the same one. */
export async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Run one guard end to end. Never throws and never exits non-zero — a guard that wedges the
 * session is worse than the mistake it was watching for — so a bad payload OR a decide() that
 * throws both fail open.
 * @param {(payload: object) => { block: boolean, reason?: string }} decideFromPayload
 */
export async function runGuard(decideFromPayload) {
  let decision = { block: false }
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
