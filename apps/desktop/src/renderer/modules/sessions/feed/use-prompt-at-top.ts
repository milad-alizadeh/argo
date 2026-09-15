import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useState } from 'react'
import type { SessionFeedRow } from '../types'

type Virtualizer = ReactVirtualizer<HTMLElement, Element>
type Pin = { sessionId: string; id: string | null }

function isPrompt(row: SessionFeedRow) {
  return row.shape === 'prose' && row.role === 'user'
}

// Where the viewport sits with the prompt at its top, a scroll-padding gap above it.
function promptTop(virtualizer: Virtualizer, index: number, gap: number) {
  const start = virtualizer.measurementsCache[index]?.start
  return start === undefined ? null : Math.max(start - gap, 0)
}

// A prompt sent while the Feed is open scrolls to the top of the viewport, so the reply streams
// into the room below it. A prompt already there when the Feed opens is left where it is.
export function usePromptAtTop({
  gap,
  positioned,
  rows,
  sessionId,
  virtualizer,
}: {
  gap: number
  positioned: boolean
  rows: readonly SessionFeedRow[]
  sessionId: string
  virtualizer: Virtualizer
}) {
  // Keyed by id, so earlier history arriving above the prompt does not read as a new one.
  const latest = rows.findLast(isPrompt)?.id ?? null
  const [seen, setSeen] = useState<Pin>({ sessionId, id: latest })
  const [pin, setPin] = useState<(Pin & { index: number }) | null>(null)
  if (seen.sessionId !== sessionId || seen.id !== latest) {
    setSeen({ sessionId, id: latest })
    if (positioned && seen.sessionId === sessionId && latest !== null)
      setPin({ sessionId, id: latest, index: rows.findLastIndex(isPrompt) })
  }
  const index = pin?.sessionId === sessionId ? rows.findLastIndex(isPrompt) : -1
  useEffect(() => {
    if (pin === null) return
    const top = promptTop(virtualizer, pin.index, gap)
    if (top !== null) virtualizer.scrollToOffset(top, { behavior: 'smooth' })
  }, [gap, pin, virtualizer])
  return index === -1 ? null : index
}

// Tall enough to scroll the pinned prompt to the top even while the reply is shorter than the
// viewport. The virtualizer reads the end from the DOM (`scrollHeight`), so following the tail
// holds the prompt there until the reply fills the room.
export function feedContentHeight(
  virtualizer: Virtualizer,
  promptIndex: number | null,
  gap: number,
) {
  const total = virtualizer.getTotalSize()
  const viewport = virtualizer.scrollElement
  if (promptIndex === null || viewport === null) return total
  const top = promptTop(virtualizer, promptIndex, gap)
  return top === null ? total : Math.max(total, top + viewport.clientHeight)
}
