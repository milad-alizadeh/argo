import { expect, waitFor } from 'storybook/test'

export async function expectReachableIn(viewport: HTMLElement, target: HTMLElement) {
  let reachable = false
  const observer = new IntersectionObserver(
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
