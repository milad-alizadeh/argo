import path from 'node:path'

export type StoredItem = { id: string; type: string; text: string }
export type StoredTurn = { id: string; status: string; startedAt: number; items: StoredItem[] }
export type StoredThread = {
  id: string
  cwd: string | null
  name: string | null
  updatedAt: number | null
  status: { type: string; message?: string }
  resumeError?: string
  turns: StoredTurn[]
}

export function transcriptsRoot() {
  return process.env.ARGO_CODEX_TRANSCRIPTS ?? ''
}

export function historyFile() {
  const override = process.env.ARGO_CODEX_VENDOR_HISTORY
  if (override !== undefined) return override
  const root = transcriptsRoot()
  return root === '' ? '' : path.join(root, 'argo-vendor-history.json')
}
