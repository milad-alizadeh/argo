import { useReducer } from 'react'

export type DisclosureAction = 'open' | 'close' | 'toggle'

/** The whole state transition, pulled out so it is testable without a renderer. */
export function disclosureReducer(isOpen: boolean, action: DisclosureAction): boolean {
  switch (action) {
    case 'open':
      return true
    case 'close':
      return false
    case 'toggle':
      return !isOpen
  }
}

export interface Disclosure {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

/**
 * A component's own local expand/collapse flag — the boring open/close/toggle triple a
 * disclosure region (a collapsible group, a "viewed" row) needs and nothing more.
 *
 * Uncontrolled by design: a caller that must observe or drive the value from outside owns
 * a `boolean` prop of its own rather than reaching into this hook's state.
 */
export function useDisclosure(options?: { defaultOpen?: boolean }): Disclosure {
  const [isOpen, dispatch] = useReducer(disclosureReducer, options?.defaultOpen ?? false)
  return {
    isOpen,
    open: () => dispatch('open'),
    close: () => dispatch('close'),
    toggle: () => dispatch('toggle'),
  }
}
