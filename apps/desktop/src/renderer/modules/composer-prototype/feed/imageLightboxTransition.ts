import { useCallback, useRef, useState } from 'react'
import {
  closeToSource,
  type ImageBounds,
  openFromSource,
  prefersReducedMotion,
  transitionElements,
} from './imageLightboxAnimation'

type TransitionState = {
  closing: boolean
  destination: ImageBounds | null
  opening: boolean
  source: ImageBounds | null
}
type CloseTransitionOptions = {
  backdropRef: { current: HTMLButtonElement | null }
  controlsRef: { current: HTMLDivElement | null }
  previewRef: { current: HTMLImageElement | null }
  setOpen: (open: boolean) => void
  sourceRef: { current: HTMLImageElement | null }
  stateRef: { current: TransitionState }
}

function useCloseTransition(options: CloseTransitionOptions) {
  return useCallback(async () => {
    if (options.stateRef.current.closing) return
    const elements = transitionElements(
      options.backdropRef.current,
      options.controlsRef.current,
      options.previewRef.current,
    )
    const source =
      options.sourceRef.current?.getBoundingClientRect() ?? options.stateRef.current.source
    const destination = options.stateRef.current.destination
    if (!elements || !source || !destination || prefersReducedMotion())
      return options.setOpen(false)
    options.stateRef.current.closing = true
    await closeToSource(elements, source, destination)
    options.setOpen(false)
    options.stateRef.current.closing = false
  }, [options])
}

export function useImageLightboxTransition() {
  const [open, setOpen] = useState(false)
  const sourceRef = useRef<HTMLImageElement>(null)
  const previewElementRef = useRef<HTMLImageElement>(null)
  const backdropRef = useRef<HTMLButtonElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<TransitionState>({
    closing: false,
    destination: null,
    opening: false,
    source: null,
  })
  const captureSourceBounds = useCallback(() => {
    stateRef.current.source = sourceRef.current?.getBoundingClientRect() ?? null
  }, [])
  const close = useCloseTransition({
    backdropRef,
    controlsRef,
    previewRef: previewElementRef,
    setOpen,
    sourceRef,
    stateRef,
  })
  const mountPreview = useCallback(
    (preview: HTMLImageElement | null) => {
      previewElementRef.current = preview
      if (!preview || !open || stateRef.current.opening || prefersReducedMotion()) return
      const elements = transitionElements(backdropRef.current, controlsRef.current, preview)
      const source = stateRef.current.source
      if (!elements || !source) return
      stateRef.current.opening = true
      stateRef.current.destination = openFromSource(elements, source)
    },
    [open],
  )
  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) return void close()
      stateRef.current.opening = false
      captureSourceBounds()
      setOpen(true)
    },
    [captureSourceBounds, close],
  )
  return {
    backdropRef,
    captureSourceBounds,
    close,
    controlsRef,
    onOpenChange,
    open,
    previewRef: mountPreview,
    sourceRef,
  }
}
