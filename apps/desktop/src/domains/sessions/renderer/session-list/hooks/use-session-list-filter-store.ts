import { create } from 'zustand'
import type { SessionListStatus } from '@/domains/sessions/contract/model/session-list-status'

export type { SessionListStatus }

type SessionListFilterState = {
  status: SessionListStatus
  setStatus: (status: SessionListStatus) => void
}

export const useSessionListFilterStore = create<SessionListFilterState>((set) => ({
  status: 'active',
  setStatus: (status) => set({ status }),
}))
