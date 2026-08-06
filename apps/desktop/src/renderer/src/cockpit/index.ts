// The composition root's wiring, behind its ONE public entry (apps/desktop/scripts/module-boundaries.json).
// `App.tsx` is the only caller: it takes the assembled props from here and hands them to the root
// View. Slices never import this — the store and the bridge are read on this side of the seam so
// that every slice can stay a pure View.

export { type GitHatches, useGitGroup } from './git/useGitGroup'
export { useSessionStore } from './projection/sessionStore'
export { RoomStage } from './RoomStage'
export { useSessionInterior } from './sessions/useSessionInterior'
export { useShellCommands } from './shell/useShellCommands'
export { type ShellState, useShellState } from './shell/useShellState'
