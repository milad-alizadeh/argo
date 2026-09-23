import type { VirtualItem } from '@tanstack/virtual-core'
import { useCallback, useRef } from 'react'

// A fresh `[]` literal on every call changes identity every render, and the virtualizer treats
// that as an options change and re-renders forever (#e2e-real-cheap-models): one shared reference
// for the "nothing saved yet" case keeps a session with no snapshot referentially stable.
export const NO_MEASUREMENTS: VirtualItem[] = []

export function useFeedMeasurementsCache() {
  const caches = useRef(new Map<string, VirtualItem[]>()).current
  const initialMeasurementsCache = useCallback(
    (sessionId: string) => caches.get(sessionId) ?? NO_MEASUREMENTS,
    [caches],
  )
  const saveMeasurementsCache = useCallback(
    (sessionId: string, cache: VirtualItem[]) => caches.set(sessionId, cache),
    [caches],
  )
  return { initialMeasurementsCache, saveMeasurementsCache }
}
