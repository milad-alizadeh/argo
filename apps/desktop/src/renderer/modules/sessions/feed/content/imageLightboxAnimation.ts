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

function boundsKeyframe(bounds: ImageBounds) {
  return {
    height: `${bounds.height}px`,
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
  }
}

export function openFromSource(elements: TransitionElements, source: ImageBounds) {
  const destination = elements.preview.getBoundingClientRect()
  const options = { duration: TRANSITION_DURATION_MS, easing: TRANSITION_EASING }
  Object.assign(elements.preview.style, {
    ...boundsKeyframe(destination),
    maxHeight: 'none',
    maxWidth: 'none',
    position: 'fixed',
  })
  elements.preview.animate([boundsKeyframe(source), boundsKeyframe(destination)], options)
  elements.backdrop.animate([{ opacity: 0 }, { opacity: 1 }], options)
  elements.controls?.animate([{ opacity: 0 }, { opacity: 1 }], options)
  return destination
}

export async function closeToSource(elements: TransitionElements, source: ImageBounds) {
  const options: KeyframeAnimationOptions = {
    duration: TRANSITION_DURATION_MS,
    easing: TRANSITION_EASING,
    fill: 'forwards',
  }
  const previewStyle = window.getComputedStyle(elements.preview)
  const animations = [
    elements.preview.animate(
      [
        {
          height: previewStyle.height,
          left: previewStyle.left,
          top: previewStyle.top,
          width: previewStyle.width,
        },
        boundsKeyframe(source),
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
