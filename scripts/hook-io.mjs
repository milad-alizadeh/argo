// The stdin/stdout half of a PreToolUse guardrail hook, shared by the guards in scripts/.
// Each guard keeps its own pure decide(); this is the plumbing around it.

/** True when a tool call is an agent's rather than the human's — guards never touch the human.
 * The marker is Claude's own CLAUDECODE, or the ARGO_HOOK_AGENT the projection injects for
 * markerless harnesses (Codex). */
export const underAgent = () => Boolean(process.env.CLAUDECODE || process.env.ARGO_HOOK_AGENT)

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Run one guard end to end. Never throws and never exits non-zero — a guard that wedges the
 * session is worse than the mistake it was watching for — so a bad payload OR a decide() that
 * throws both fail open. Asserted in hook-io.test.mjs.
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
