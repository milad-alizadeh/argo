import type { ReactVirtualizer } from '@tanstack/react-virtual'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import { usePromptAtTop } from './use-prompt-at-top'

export function useFeedPrompt({
  positioned,
  rows,
  sessionId,
  virtualizer,
  updatePromptHold,
  paddingStart,
}: {
  positioned: boolean
  rows: readonly SessionFeedRow[]
  sessionId: string
  virtualizer: ReactVirtualizer<HTMLElement, Element>
  updatePromptHold: (
    virtualizer: ReactVirtualizer<HTMLElement, Element>,
    promptIndex: number | null,
    paddingStart: number,
  ) => void
  paddingStart: number
}) {
  const promptIndex = usePromptAtTop({ positioned, rows, sessionId, virtualizer })
  updatePromptHold(virtualizer, promptIndex, paddingStart)
  return promptIndex
}
