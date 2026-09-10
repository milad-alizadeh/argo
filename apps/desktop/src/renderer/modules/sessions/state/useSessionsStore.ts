import { create } from 'zustand'

import type { SessionId } from '../types'

type SessionsState = {
  selectedSessionId: SessionId | null
  selectSession: (sessionId: SessionId | null) => void
}

export const useSessionsStore = create<SessionsState>((set) => ({
  selectedSessionId: null,
  selectSession: (selectedSessionId) => set({ selectedSessionId }),
}))
