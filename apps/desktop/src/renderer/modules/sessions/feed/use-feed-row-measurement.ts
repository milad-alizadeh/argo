import type { Virtualizer } from '@tanstack/virtual-core'
import { useCallback, useRef } from 'react'

export function useFeedRowMeasurement() {
  const measurements = useRef(new Map<string, { height: number; wasAboveViewport: boolean }>())
  return useCallback(
    (
      element: Element,
      entry: ResizeObserverEntry | undefined,
      instance: Virtualizer<HTMLElement, Element>,
    ) => {
      const height = entry?.borderBoxSize[0]?.blockSize ?? (element as HTMLElement).offsetHeight
      const index = instance.indexFromElement(element)
      const key = String(instance.options.getItemKey(index))
      const previous = measurements.current.get(key)
      const item = instance.getVirtualItems().find((virtualItem) => virtualItem.index === index)
      const viewport = instance.scrollElement
      const wasAboveViewport =
        item !== undefined && viewport !== null && item.start + height <= viewport.scrollTop
      const virtualizerWillAdjust =
        item !== undefined &&
        instance.scrollDirection !== 'backward' &&
        item.end <= (instance.scrollOffset ?? 0)
      if (
        previous !== undefined &&
        previous.height !== height &&
        item !== undefined &&
        viewport !== null &&
        previous.wasAboveViewport &&
        !virtualizerWillAdjust
      ) {
        instance.scrollToOffset(viewport.scrollTop + height - previous.height)
      }
      measurements.current.set(key, { height, wasAboveViewport })
      return height
    },
    [],
  )
}
