// The composition root's wiring, behind its ONE public entry (apps/desktop/scripts/module-boundaries.json).
// `App.tsx` is the only caller: it takes the assembled props from here and hands them to the root
// View. Slices never import this — the store and the bridge are read on this side of the seam so
// that every slice can stay a pure View.
export { RoomStage } from './RoomStage'
export { useSessionStore } from './sessionStore'
export { type GitHatches, useGitGroup } from './useGitGroup'
export { useSessionInterior } from './useSessionInterior'
export { useShellCommands } from './useShellCommands'
export { type ShellState, useShellState } from './useShellState'
