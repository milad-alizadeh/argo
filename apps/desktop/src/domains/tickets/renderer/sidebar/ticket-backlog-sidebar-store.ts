import { create } from 'zustand'
import type { Backlog } from '../lib/backlog'

type TicketBacklogSidebar = {
  backlog: Backlog
  selectedKey: string | null
  onSelect: (key: string) => void
}

type TicketBacklogSidebarState = {
  sidebar: TicketBacklogSidebar | null
  setSidebar: (sidebar: TicketBacklogSidebar | null) => void
}

// The shell and the selected workspace are siblings. This small screen projection keeps the
// shell's backlog derived from the one Ticket deck rather than starting a second read.
export const useTicketBacklogSidebar = create<TicketBacklogSidebarState>((set) => ({
  sidebar: null,
  setSidebar: (sidebar) => set({ sidebar }),
}))
