import { type MutableRefObject, type RefObject, useEffect, useState } from 'react'

import type { Reading } from './heights'
import { containerReading } from './measure'

// Rule 6: the Feed stays at its old width, clipped, for the length of a drag, and one pass runs
// at drag end. This is that "drag end" — a width that has stopped moving.
const RESIZE_SETTLE_MS = 180
const GEOMETRY_REFRESH_MS = 500

// The column is what a drag resizes, so it is what the observer watches. The width the pass keys
// on is read elsewhere, off the container the rows are actually laid out in.
export function useSettledWidth(
  active: boolean,
  activeRef: MutableRefObject<boolean>,
  column: RefObject<HTMLElement | null>,
) {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    if (!active) return
    const element = column.current
    if (element === null) return
    let timer: number | undefined
    const observer = new ResizeObserver(() => {
      if (!activeRef.current) return
      window.clearTimeout(timer)
      timer = window.setTimeout(
        () => setWidth(element.getBoundingClientRect().width),
        RESIZE_SETTLE_MS,
      )
    })
    observer.observe(element)
    setWidth(element.getBoundingClientRect().width)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [active, activeRef, column])
  return width
}

// A font load or Electron zoom change can leave the CSS width alone while changing every prose
// height. Watch those other two invalidators only while this visible deck may read layout.
export type Geometry = Pick<Reading, 'font' | 'zoom'>

export function useGeometry(
  active: boolean,
  activeRef: MutableRefObject<boolean>,
  measured: RefObject<HTMLElement | null>,
) {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  useEffect(() => {
    if (!active) {
      setGeometry(null)
      return
    }
    const container = measured.current
    if (container === null) return
    if (!activeRef.current) return
    let current = geometryOf(container)
    setGeometry(current)
    const reread = () => {
      if (!activeRef.current) return
      const next = geometryOf(container)
      if (geometryKey(next) === geometryKey(current)) return
      current = next
      setGeometry(next)
    }
    document.fonts.addEventListener('loadingdone', reread)
    const timer = window.setInterval(reread, GEOMETRY_REFRESH_MS)
    return () => {
      document.fonts.removeEventListener('loadingdone', reread)
      window.clearInterval(timer)
    }
  }, [active, activeRef, measured])
  return geometry
}

function geometryOf(container: HTMLElement): Geometry {
  const reading = containerReading(container)
  return { font: reading.font, zoom: reading.zoom }
}

function geometryKey(geometry: Geometry) {
  return JSON.stringify(geometry)
}
