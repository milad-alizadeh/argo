// Runs one onboarding turn (planning or application) against the app's configured Claude driver.
// ADR-0024 rules out `claude -p`/Agent SDK for billing reasons,
// so this stays on the interactive subscription path: it starts a normal managed Session, feeds
// it one prompt, and reads its streamed output until the prompt's own completion marker appears.
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'

export type OnboardingAgentDriver = {
  start(request: { cwd: string; prompt: string; setup: ClaudeTurnSetup }): string
  send(sessionId: string, turn: { prompt: string; setup: ClaudeTurnSetup }): Promise<void>
  liveMessages(sessionId: string): Array<{ text: string }>
  interrupt(sessionId: string): void | Promise<void>
  hasSession?(sessionId: string): boolean
  waitForStop?(sessionId: string): Promise<void>
  pendingPermission(
    sessionId: string,
  ): { id: string; description?: string; input?: Record<string, unknown>; toolName?: string } | null
  decidePermission(
    sessionId: string,
    permissionId: string,
    decision: 'allowSimilar' | 'deny',
  ): boolean
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
  onStarted?: (sessionId: string) => void
  onPermission?: (permission: { id: string; description: string }) => void
  sessionId?: string
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
  const setup = {
    model: request.model ?? 'opus',
    effort: request.effort ?? 'high',
    mode: request.mode,
  } as const
  const sessionId =
    request.sessionId ?? driver.start({ cwd: request.cwd, prompt: request.prompt, setup })
  if (request.sessionId === undefined) request.onStarted?.(sessionId)
  else await driver.send(sessionId, { prompt: request.prompt, setup })

  const observed = await observeOnboardingTurn(driver, request, sessionId)
  if (observed.payload !== null)
    return { outcome: 'completed', sessionId, payload: observed.payload }

  try {
    await driver.interrupt(sessionId)
  } catch {
    // The Session may already have exited on its own; nothing left to interrupt.
  }
  return { outcome: 'timed-out', sessionId, lastText: observed.lastText }
}

async function observeOnboardingTurn(
  driver: OnboardingAgentDriver,
  request: RunOnboardingAgentRequest,
  sessionId: string,
): Promise<{ lastText: string; payload: string | null }> {
  const deadline = Date.now() + (request.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const pollIntervalMs = request.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  let lastText = ''
  let pendingPermissionId: string | null = null
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    pendingPermissionId = reportPendingPermission({
      driver,
      request,
      sessionId,
      previousPermissionId: pendingPermissionId,
    })
    const text = liveText(driver, sessionId)
    if (text !== lastText) {
      lastText = text
      request.onProgress?.(text)
    }
    const payload = extractMarkedPayload(text, request.marker)
    if (payload !== null) return { lastText, payload }
  }
  return { lastText, payload: null }
}

function reportPendingPermission({
  driver,
  request,
  sessionId,
  previousPermissionId,
}: {
  driver: OnboardingAgentDriver
  request: RunOnboardingAgentRequest
  sessionId: string
  previousPermissionId: string | null
}): string | null {
  const pending = driver.pendingPermission(sessionId)
  if (!pending) return null
  if (pending.id !== previousPermissionId)
    request.onPermission?.({ id: pending.id, description: permissionDescription(pending) })
  return pending.id
}

function permissionDescription({
  description,
  input,
  toolName,
}: {
  description?: string
  input?: Record<string, unknown>
  toolName?: string
}): string {
  if (description !== undefined) return description
  return toolName === undefined ? 'Agent tool action' : `${toolName} ${JSON.stringify(input ?? {})}`
}

function liveText(driver: OnboardingAgentDriver, sessionId: string): string {
  return driver
    .liveMessages(sessionId)
    .map((message) => message.text)
    .join('\n\n')
}
