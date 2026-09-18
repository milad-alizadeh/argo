import type { BackgroundTask } from '@/domains/sessions/contract/signals'
import type { TranscriptMessage } from '@/domains/sessions/contract/transcript'
import type { SessionChain } from './chains'

export type RosterRowContext = {
  chain: SessionChain
  cli: string
  messages: TranscriptMessage[]
  notifications: BackgroundTask[]
  title: { text: string; source: 'custom' | 'summarised' | 'first-prompt' } | null
  status: string
  entry: string
  place: { cwd: string | null; branch: string | null }
  updatedAt: string | null
  turnStartedAt: string | null
  activity: unknown
  plan: unknown
  delegations: unknown
  shell: unknown
  pullRequest: unknown
  usage: { contextTokens: unknown; spentTokens: unknown }
  contextWindowTokens: unknown
  setup: unknown
}
