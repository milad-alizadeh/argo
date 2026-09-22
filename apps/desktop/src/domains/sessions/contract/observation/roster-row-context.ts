import type { SessionChain } from '../model'
import type { TranscriptMessage } from '../model'
import type { BackgroundTask } from './signals'

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
