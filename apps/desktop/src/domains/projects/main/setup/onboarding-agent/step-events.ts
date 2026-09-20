// Reads the ARGO_STEP progress protocol both onboarding prompts follow (see prompts.ts) out of a
// managed Session's streamed text.
import {
  type SetupApplicationProgressEvent,
  type SetupPlanningProgressEvent,
  setupApplicationProgressEventSchema,
  setupPlanningProgressEventSchema,
} from '@/domains/projects/contract/setup-progress'

const STEP_LINE = /^ARGO_STEP (\{.*\})$/gm

function stepPayloads(text: string): unknown[] {
  const payloads: unknown[] = []
  for (const match of text.matchAll(STEP_LINE)) {
    try {
      payloads.push(JSON.parse(match[1] as string))
    } catch {
      // A malformed step line is dropped; the final marked payload still carries the outcome.
    }
  }
  return payloads
}

function withRevision(payload: unknown, revision: string) {
  return { ...(typeof payload === 'object' && payload !== null ? payload : {}), revision }
}

export function parsePlanningStepEvents(
  text: string,
  revision: string,
): SetupPlanningProgressEvent[] {
  return stepPayloads(text).flatMap((payload) => {
    const parsed = setupPlanningProgressEventSchema.safeParse(withRevision(payload, revision))
    return parsed.success ? [parsed.data] : []
  })
}

export function parseApplicationStepEvents(
  text: string,
  revision: string,
): SetupApplicationProgressEvent[] {
  return stepPayloads(text).flatMap((payload) => {
    const parsed = setupApplicationProgressEventSchema.safeParse(withRevision(payload, revision))
    return parsed.success ? [parsed.data] : []
  })
}
