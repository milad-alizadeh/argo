import type { SessionChain } from '@/domains/sessions/contract/model/chains'
import type { TranscriptMessage } from '@/domains/sessions/contract/model/transcript'
import type { BackgroundTask } from '@/domains/sessions/contract/observation/signals'

export type RosterRowContext = {
  chain: SessionChain
  harness: string
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
  subagents: unknown
  shell: unknown
  pullRequest: unknown
  usage: { contextTokens: unknown; spentTokens: unknown }
  contextWindowTokens: unknown
  setup: unknown
}
