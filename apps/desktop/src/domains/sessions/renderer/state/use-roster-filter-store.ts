import { create } from 'zustand'

// Which Sessions the roster shows. The Archive used to be a disclosure row inside the list, which
// made it a place in the list rather than a way of reading it; it is a filter over one list now.
export type RosterStatus = 'active' | 'archived' | 'all'

type RosterFilterState = {
  status: RosterStatus
  setStatus: (status: RosterStatus) => void
}

export const useRosterFilterStore = create<RosterFilterState>((set) => ({
  status: 'active',
  setStatus: (status) => set({ status }),
}))

export function useRosterStatus(): RosterStatus {
  return useRosterFilterStore((state) => state.status)
}

// Whether the current filter asks for archived Sessions at all, which is what decides if the
// Archive is read.
export function showsArchived(status: RosterStatus): boolean {
  return status !== 'active'
}

export function showsActive(status: RosterStatus): boolean {
  return status !== 'archived'
}
