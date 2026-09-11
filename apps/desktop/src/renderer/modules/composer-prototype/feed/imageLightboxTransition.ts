import { useCallback, useLayoutEffect, useRef, useState } from 'react'

const TRANSITION_DURATION_MS = 240
const TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

type ImageBounds = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>
type TransitionElements = {
  backdrop: HTMLDivElement
  controls: HTMLDivElement | null
  preview: HTMLImageElement
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function transitionFromBounds(source: ImageBounds, destination: ImageBounds) {
  const sourceCenterX = source.left + source.width / 2
  const sourceCenterY = source.top + source.height / 2
  const destinationCenterX = destination.left + destination.width / 2
  const destinationCenterY = destination.top + destination.height / 2
  return `translate(${sourceCenterX - destinationCenterX}px, ${sourceCenterY - destinationCenterY}px) scale(${source.width / destination.width}, ${source.height / destination.height})`
}

function openFromSource(elements: TransitionElements, source: ImageBounds) {
  const destination = elements.preview.getBoundingClientRect()
  const options = { duration: TRANSITION_DURATION_MS, easing: TRANSITION_EASING }
  elements.preview.animate(
    [{ transform: transitionFromBounds(source, destination) }, { transform: 'none' }],
    options,
  )
  elements.backdrop.animate([{ opacity: 0 }, { opacity: 1 }], options)
  elements.controls?.animate([{ opacity: 0 }, { opacity: 1 }], options)
  return destination
}

async function closeToSource(
  elements: TransitionElements,
  source: ImageBounds,
  destination: ImageBounds,
) {
  const options: KeyframeAnimationOptions = {
    duration: TRANSITION_DURATION_MS,
    easing: TRANSITION_EASING,
    fill: 'forwards',
  }
  const animations = [
    elements.preview.animate(
      [
        { transform: window.getComputedStyle(elements.preview).transform },
        { transform: transitionFromBounds(source, destination) },
      ],
      options,
    ),
    elements.backdrop.animate(
      [{ opacity: window.getComputedStyle(elements.backdrop).opacity }, { opacity: 0 }],
      options,
    ),
  ]
  if (elements.controls) {
    animations.push(
      elements.controls.animate(
        [{ opacity: window.getComputedStyle(elements.controls).opacity }, { opacity: 0 }],
        options,
      ),
    )
  }
  await Promise.allSettled(animations.map((animation) => animation.finished))
}

export function useImageLightboxTransition() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLImageElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const sourceBoundsRef = useRef<ImageBounds | null>(null)
  const destinationBoundsRef = useRef<ImageBounds | null>(null)
  const closingRef = useRef(false)
  const captureSourceBounds = useCallback(() => {
    sourceBoundsRef.current = triggerRef.current?.getBoundingClientRect() ?? null
  }, [])
  const getElements = useCallback(() => {
    const backdrop = backdropRef.current
    const preview = previewRef.current
    return backdrop && preview ? { backdrop, controls: controlsRef.current, preview } : null
  }, [])
  const close = useCallback(async () => {
    if (closingRef.current) return
    const elements = getElements()
    const source = triggerRef.current?.getBoundingClientRect() ?? sourceBoundsRef.current
    const destination = destinationBoundsRef.current
    if (!elements || !source || !destination || prefersReducedMotion()) return setOpen(false)
    closingRef.current = true
    await closeToSource(elements, source, destination)
    setOpen(false)
    closingRef.current = false
  }, [getElements])
  useLayoutEffect(() => {
    if (!open || prefersReducedMotion()) return
    const elements = getElements()
    const source = sourceBoundsRef.current
    if (elements && source) destinationBoundsRef.current = openFromSource(elements, source)
  }, [getElements, open])
  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) return void close()
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
    previewRef,
    triggerRef,
  }
}
