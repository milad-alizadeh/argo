// The stdin/stdout half of a PreToolUse guardrail hook, shared by the guards rather than
// copied into each. Every guard is the same shape: read one JSON payload, ask a pure decide()
// what it thinks, emit a deny or say nothing at all. Only decide() differs, and only decide()
// is worth unit-testing — which is why it is the half that stays in each guard's own file.
//
// Env-neutral by design, like the guards themselves: the agent marker is Claude's own
// CLAUDECODE, or the ARGO_HOOK_AGENT the projection injects for markerless harnesses (Codex).

/** True when a tool call is an agent's rather than the human's — guards never touch the human. */
export const isAgent = () => Boolean(process.env.CLAUDECODE || process.env.ARGO_HOOK_AGENT)

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Run one guard end to end. Never throws and never exits non-zero: a guard that wedges the
 * session is worse than the mistake it was watching for.
 * @param {(payload: object) => { block: boolean, reason?: string }} decideFromPayload
 */
export async function runGuard(decideFromPayload) {
  let payload = {}
  try {
    payload = JSON.parse((await readStdin()) || '{}')
  } catch {
    // Malformed payload — fail open.
  }

  const decision = decideFromPayload(payload)
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
