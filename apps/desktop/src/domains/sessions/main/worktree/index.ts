export { createWorktree } from './worktree-create'
export { folderPresent } from './worktree-folder'
export {
  mainCheckout,
  projectFolders,
  type WorktreeOptionsContext,
  worktreeOptionsProcedure,
  worktreeSwitchProcedure,
} from './worktree-options'
export {
  type RemovalOutcome,
  type RemovedWorktree,
  removedWorktreeSchema,
  removeSessionWorktrees,
  type WorktreeRemoval,
  worktreeRemovalSchema,
  worktreesWithWork,
} from './worktree-removal'
