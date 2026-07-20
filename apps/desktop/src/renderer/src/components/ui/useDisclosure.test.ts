// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useDisclosure } from './useDisclosure'

beforeAll(() => {
  // Told once, globally: this file drives React state updates through `act`, not a browser
  // event loop, so React must not warn that nothing configured it for testing.
  // biome-ignore lint/suspicious/noExplicitAny: the flag React's own act() checks for
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
})

// A hook only runs inside a component render. The harness mounts one function component per
// test and hands back the mutable box its render writes into, so a caller re-reads `.value`
// after each `act()` rather than closing over a stale render's tuple.
function mount<T>(useHook: () => T): { value: T; root: Root } {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const box = {} as { value: T }
  function Harness(): null {
    box.value = useHook()
    return null
  }
  act(() => {
    root.render(createElement(Harness))
  })
  return {
    get value() {
      return box.value
    },
    root,
  }
}

describe('useDisclosure', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('tracks its own state, seeded by defaultOpen, when uncontrolled', () => {
    const harness = mount(() => useDisclosure({ defaultOpen: true }))
    cleanup = () => act(() => harness.root.unmount())
    const [open] = harness.value
    expect(open).toBe(true)
  })

  it('flips on toggle when uncontrolled', () => {
    const harness = mount(() => useDisclosure({ defaultOpen: false }))
    cleanup = () => act(() => harness.root.unmount())
    act(() => harness.value[1]())
    expect(harness.value[0]).toBe(true)
    act(() => harness.value[1]())
    expect(harness.value[0]).toBe(false)
  })

  it('reports every transition through onOpenChange, controlled or not', () => {
    const seen: boolean[] = []
    const harness = mount(() =>
      useDisclosure({ defaultOpen: false, onOpenChange: (next) => seen.push(next) }),
    )
    cleanup = () => act(() => harness.root.unmount())
    act(() => harness.value[1]())
    expect(seen).toEqual([true])
  })

  it('never flips its own state once controlled — toggle only reports intent', () => {
    const seen: boolean[] = []
    const harness = mount(() =>
      useDisclosure({ open: false, onOpenChange: (next) => seen.push(next) }),
    )
    cleanup = () => act(() => harness.root.unmount())
    act(() => harness.value[1]())
    // `open` still reads false: the hook never re-derives it from the report it just sent —
    // that is exactly the contract, the CALLER owns the value once `open` is passed.
    expect(harness.value[0]).toBe(false)
    expect(seen).toEqual([true])
  })
})
