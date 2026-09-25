import { create } from 'zustand'
import type { TicketWorkPath } from './ticket-work-path'

export type TicketPlanningSidebar = {
  path: TicketWorkPath | null
  onSelect: (key: string) => void
}

type TicketPlanningSidebarState = {
  planning: TicketPlanningSidebar | null
  setPlanning: (planning: TicketPlanningSidebar | null) => void
}

// The shell sidebar and Tickets workspace are siblings. This projection lets the workspace publish
// provider-backed planning facts without putting list or detail navigation into the shell.
export const useTicketPlanningSidebar = create<TicketPlanningSidebarState>((set) => ({
  planning: null,
  setPlanning: (planning) => set({ planning }),
}))
