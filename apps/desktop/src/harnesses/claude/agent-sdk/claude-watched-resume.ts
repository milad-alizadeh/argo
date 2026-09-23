import { getSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import { beginWatchedResume } from '@/harnesses/composition/begin-watched-resume'

const LEASE_REFUSAL = 'Another Argo window is driving this Claude Session.'

export async function readClaudeResumePermission(sessionId: string) {
  try {
    const session = await getSessionInfo(sessionId)
    return session === undefined
      ? { resumable: false as const, reason: 'Claude could not find this Session.' }
      : { resumable: true as const }
  } catch (error) {
    return {
      resumable: false as const,
      reason: error instanceof Error ? error.message : 'Claude Session history is unavailable.',
    }
  }
}

export const beginWatchedClaudeResume = (
  options: Omit<Parameters<typeof beginWatchedResume>[0], 'leaseRefusal' | 'openFailure'>,
) =>
  beginWatchedResume({
    ...options,
    leaseRefusal: LEASE_REFUSAL,
    openFailure: 'Claude refused to resume this Session.',
  })
