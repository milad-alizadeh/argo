import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type ProjectSelectionState = {
  selectedProjectId: string | null
  selectProject: (projectId: string | null) => void
}

export const useProjectSelectionStore = create<ProjectSelectionState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectProject: (selectedProjectId) => set({ selectedProjectId }),
    }),
    {
      name: 'argo.project-selection',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ selectedProjectId }) => ({ selectedProjectId }),
    },
  ),
)
