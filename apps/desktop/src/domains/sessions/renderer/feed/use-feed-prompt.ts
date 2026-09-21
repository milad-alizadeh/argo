import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { usePromptAtTop } from '@/domains/sessions/renderer/feed/use-prompt-at-top'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'

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
