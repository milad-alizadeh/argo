import type { managedWorkspaceRecovery } from './schema'

export type ManagedWorkspaceRecoveryRow = typeof managedWorkspaceRecovery.$inferSelect
export type NewManagedWorkspaceRecovery = typeof managedWorkspaceRecovery.$inferInsert
