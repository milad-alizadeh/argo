import { expect, waitFor } from 'storybook/test'

type ReachabilityObserverConstructor = new (
  callback: (entries: { target: EventTarget; isIntersecting: boolean }[]) => void,
  options: { root: HTMLElement },
) => {
  observe(target: HTMLElement): void
  disconnect(): void
}

export async function expectReachableIn(
  viewport: HTMLElement,
  target: HTMLElement,
  ObserverConstructor: ReachabilityObserverConstructor,
) {
  let reachable = false
  const observer = new ObserverConstructor(
    (entries) => {
      reachable = entries.some((entry) => entry.target === target && entry.isIntersecting)
    },
    { root: viewport },
  )
  observer.observe(target)
  try {
    await waitFor(() => expect(reachable).toBe(true))
  } finally {
    observer.disconnect()
  }
}
