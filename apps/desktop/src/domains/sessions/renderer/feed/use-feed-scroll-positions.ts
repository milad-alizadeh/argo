import { useCallback, useRef } from 'react'

export function useFeedScrollPositions() {
  const positions = useRef(new Map<string, number>()).current
  const initialPosition = useCallback(
    (sessionId: string) => positions.get(sessionId) ?? null,
    [positions],
  )
  const savePosition = useCallback(
    (sessionId: string, position: number) => positions.set(sessionId, position),
    [positions],
  )
  return { initialPosition, savePosition }
}
