// Runs one onboarding turn (planning or application) against the app's real, already-composed
// Claude Session driver (see harnesses/composition/session-bridges.ts) — the same driver that
// drives ordinary managed Sessions. ADR-0024 rules out `claude -p`/Agent SDK for billing reasons,
// so this stays on the interactive subscription path: it starts a normal managed Session, feeds
// it one prompt, and reads its streamed output until the prompt's own completion marker appears.
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'

export type OnboardingAgentDriver = {
  start(request: { cwd: string; prompt: string; setup: ClaudeTurnSetup }): string
  liveMessages(sessionId: string): Array<{ text: string }>
  interrupt(sessionId: string): void
  pendingPermission(sessionId: string): { id: string } | null
  decidePermission(sessionId: string, permissionId: string, decision: 'allowSimilar'): boolean
}

export type RunOnboardingAgentRequest = {
  cwd: string
  prompt: string
  mode: ClaudeTurnSetup['mode']
  model?: ClaudeTurnSetup['model']
  effort?: ClaudeTurnSetup['effort']
  /** The literal line the prompt instructs the agent to print right before its final JSON. */
  marker: string
  timeoutMs?: number
  pollIntervalMs?: number
  onProgress?: (text: string) => void
}

export type RunOnboardingAgentOutcome =
  | { outcome: 'completed'; sessionId: string; payload: string }
  | { outcome: 'timed-out'; sessionId: string; lastText: string }

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 500
const FENCE = /```(?:json)?\s*\n([\s\S]*?)\n```/

export function extractMarkedPayload(text: string, marker: string): string | null {
  const markerIndex = text.indexOf(marker)
  if (markerIndex < 0) return null
  const fenceMatch = text.slice(markerIndex + marker.length).match(FENCE)
  return fenceMatch?.[1] ?? null
}

export async function runOnboardingAgent(
  driver: OnboardingAgentDriver,
  request: RunOnboardingAgentRequest,
): Promise<RunOnboardingAgentOutcome> {
  const sessionId = driver.start({
    cwd: request.cwd,
    prompt: request.prompt,
    setup: {
      model: request.model ?? 'opus',
      effort: request.effort ?? 'high',
      mode: request.mode,
    },
  })

  const deadline = Date.now() + (request.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const pollIntervalMs = request.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  let lastText = ''

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    // No human watches this Session, so it must self-answer its own tool permission prompts: the
    // turn runs inside a disposable setup worktree the caller already prepared for exactly this.
    const pending = driver.pendingPermission(sessionId)
    if (pending) driver.decidePermission(sessionId, pending.id, 'allowSimilar')
    const text = driver
      .liveMessages(sessionId)
      .map((message) => message.text)
      .join('\n\n')
    if (text !== lastText) {
      lastText = text
      request.onProgress?.(text)
    }
    const payload = extractMarkedPayload(text, request.marker)
    if (payload !== null) return { outcome: 'completed', sessionId, payload }
  }

  try {
    driver.interrupt(sessionId)
  } catch {
    // The Session may already have exited on its own; nothing left to interrupt.
  }
  return { outcome: 'timed-out', sessionId, lastText }
}
