import type { ReactVirtualizer } from '@tanstack/react-virtual'
import { useEffect } from 'react'

const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' '])

// TanStack re-aims a `scrollToIndex` for up to five seconds each time its target row moves, even
// after the reader scrolled away, so a row resizing above the target took the reader back to it
// (#2960). The reader's own gesture replaces that scroll with the place they are at.
export function useReaderScrollWins(
  viewport: HTMLElement | null,
  virtualizer: ReactVirtualizer<HTMLElement, Element>,
) {
  useEffect(() => {
    if (viewport === null) return
    const keepReaderPlace = () => virtualizer.scrollToOffset(viewport.scrollTop)
    const onKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) keepReaderPlace()
    }
    // Only a press on the viewport itself, which is its scrollbar or padding, not on a row.
    const onPointer = (event: PointerEvent) => {
      if (event.target === viewport) keepReaderPlace()
    }
    viewport.addEventListener('wheel', keepReaderPlace, { passive: true })
    viewport.addEventListener('touchmove', keepReaderPlace, { passive: true })
    viewport.addEventListener('keydown', onKey)
    viewport.addEventListener('pointerdown', onPointer)
    return () => {
      viewport.removeEventListener('wheel', keepReaderPlace)
      viewport.removeEventListener('touchmove', keepReaderPlace)
      viewport.removeEventListener('keydown', onKey)
      viewport.removeEventListener('pointerdown', onPointer)
    }
  }, [viewport, virtualizer])
}
