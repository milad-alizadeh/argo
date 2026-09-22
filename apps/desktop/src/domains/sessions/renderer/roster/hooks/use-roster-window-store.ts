import { create } from 'zustand'
import type { SessionId } from '../../types'

// How much Session history the reader has asked for, held per project scope and shared by every
// consumer of the roster.
//
// Three hooks read the roster (the sidebar, the Session screen and a Ticket's linked Sessions) and
// all three resolve to one query key, so a cursor held privately by one of them is a window the
// others overwrite: the Session screen polls twice a second carrying the cold cursor, and each poll
// republished the first page over the larger window the reader had just scrolled open. The rows the
// reader had loaded disappeared. Keeping the cursor here makes the window belong to the roster
// rather than to whichever component happened to grow it.
//
// A cursor is opaque. It is whatever `nextCursor` the previous reply carried, never a window size
// this side computes.
//
// The order the reader sees is held here for the same reason. It used to live in a ref inside the
// sidebar, so every remount of the sidebar forgot it and the list snapped back to the order the read
// returns, which is most-recently-written first: the rows visibly resorted under the reader.
type RosterWindowState = {
  cursors: Record<string, string | null>
  orders: Record<string, readonly SessionId[]>
  grow: (projectRoot: string | null, nextCursor: string) => void
  remember: (scope: string | null, sessionIds: readonly SessionId[]) => void
}

const NO_ORDER: readonly SessionId[] = []

function sameOrder(left: readonly SessionId[], right: readonly SessionId[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

// One key per project scope, plus one standing for the unscoped whole machine. A NUL cannot occur
// in a path, so no project collides with it.
const EVERY_PROJECT = '\0every-project'

function scopeKey(projectRoot: string | null): string {
  return projectRoot ?? EVERY_PROJECT
}

export const useRosterWindowStore = create<RosterWindowState>((set) => ({
  cursors: {},
  orders: {},
  grow: (projectRoot, nextCursor) =>
    set((state) => ({ cursors: { ...state.cursors, [scopeKey(projectRoot)]: nextCursor } })),
  // An unchanged order leaves the state alone, so recording the order a render just drew cannot
  // trigger the render that records it again.
  remember: (scope, sessionIds) =>
    set((state) => {
      const key = scopeKey(scope)
      if (sameOrder(state.orders[key] ?? NO_ORDER, sessionIds)) return state
      return { orders: { ...state.orders, [key]: sessionIds } }
    }),
}))

// Each scope keeps its own window, so switching project shows that project's window from cold
// rather than inheriting the size the previous one had grown to.
export function useRosterWindowCursor(projectRoot: string | null): string | null {
  return useRosterWindowStore((state) => state.cursors[scopeKey(projectRoot)] ?? null)
}

export function useRememberedRosterOrder(scope: string | null): readonly SessionId[] {
  return useRosterWindowStore((state) => state.orders[scopeKey(scope)] ?? NO_ORDER)
}
