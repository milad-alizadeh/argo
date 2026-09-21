import { create } from 'zustand'
import type { Session } from '@/domains/sessions/renderer/types'

type SearchSelectionState = {
  session: Session | null
  setSession: (session: Session | null) => void
}

export const useSearchSelection = create<SearchSelectionState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}))
