const TRANSITION_DURATION_MS = 240
const TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

export type ImageBounds = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>
export type TransitionElements = {
  backdrop: HTMLButtonElement
  controls: HTMLDivElement | null
  preview: HTMLImageElement
}

export function transitionElements(
  backdrop: HTMLButtonElement | null,
  controls: HTMLDivElement | null,
  preview: HTMLImageElement | null,
) {
  return backdrop && preview ? { backdrop, controls, preview } : null
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function transitionFromBounds(source: ImageBounds, destination: ImageBounds) {
  const sourceCenterX = source.left + source.width / 2
  const sourceCenterY = source.top + source.height / 2
  const destinationCenterX = destination.left + destination.width / 2
  const destinationCenterY = destination.top + destination.height / 2
  return `translate(${sourceCenterX - destinationCenterX}px, ${sourceCenterY - destinationCenterY}px) scale(${source.width / destination.width}, ${source.height / destination.height})`
}

export function openFromSource(elements: TransitionElements, source: ImageBounds) {
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

export async function closeToSource(
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
