import type { SetupDocument } from '../../contract/setup-document'

export type SetupAdapter = {
  id: string
  available: () => Promise<boolean>
  start: (request: {
    worktreePath: string
    document: SetupDocument
  }) => Promise<{ sessionId: string }>
}

export async function selectSetupAdapter(
  adapters: readonly SetupAdapter[],
  adapterId: string,
): Promise<SetupAdapter | null> {
  const adapter = adapters.find(({ id }) => id === adapterId)
  if (!adapter || !(await adapter.available())) return null
  return adapter
}

export async function startSetupSession(request: {
  adapters: readonly SetupAdapter[]
  adapterId: string
  worktreePath: string
  document: SetupDocument
}): Promise<{ sessionId: string } | null> {
  const adapter = await selectSetupAdapter(request.adapters, request.adapterId)
  if (!adapter) return null
  return adapter.start({ worktreePath: request.worktreePath, document: request.document })
}
