import { create } from 'zustand'
import type { SessionListStatus } from '@/domains/sessions/contract/model/session-list-status'

// Which Sessions the sessionList shows. The Archive used to be a disclosure row inside the list, which
// made it a place in the list rather than a way of reading it; it is a filter over one list now.
// The type is the search contract's own (#2375): search and the SessionList/Archive scope by the same
// three values, so one definition serves all of them.
export type { SessionListStatus }

type SessionListFilterState = {
  status: SessionListStatus
  setStatus: (status: SessionListStatus) => void
}

export const useSessionListFilterStore = create<SessionListFilterState>((set) => ({
  status: 'active',
  setStatus: (status) => set({ status }),
}))

export function useSessionListStatus(): SessionListStatus {
  return useSessionListFilterStore((state) => state.status)
}

// Whether the current filter asks for archived Sessions at all, which is what decides if the
// Archive is read.
export function showsArchived(status: SessionListStatus): boolean {
  return status !== 'active'
}

export function showsActive(status: SessionListStatus): boolean {
  return status !== 'archived'
}
