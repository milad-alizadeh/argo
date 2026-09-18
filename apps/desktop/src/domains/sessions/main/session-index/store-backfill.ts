// Reading and writing how far background backfill has walked (#2373), split out of `store.ts` to
// keep it under the file line ceiling.
import type { DatabaseSync } from 'node:sqlite'
import type { BackfillProgress } from './contract'

type BackfillRecord = {
  boundary_written_at: number | null
  boundary_path: string | null
  complete: number
}

export function backfillProgressOf(database: DatabaseSync, cli: string): BackfillProgress {
  const record = database
    .prepare(
      'SELECT boundary_written_at, boundary_path, complete FROM backfill_progress WHERE cli = ?',
    )
    .get(cli) as BackfillRecord | undefined
  if (record === undefined) return { boundary: null, complete: false }
  const boundary =
    record.boundary_written_at === null || record.boundary_path === null
      ? null
      : { writtenAt: record.boundary_written_at, path: record.boundary_path }
  return { boundary, complete: record.complete === 1 }
}

export function writeBackfillProgress(
  database: DatabaseSync,
  cli: string,
  progress: BackfillProgress,
) {
  database
    .prepare(
      `INSERT OR REPLACE INTO backfill_progress (cli, boundary_written_at, boundary_path, complete)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      cli,
      progress.boundary?.writtenAt ?? null,
      progress.boundary?.path ?? null,
      progress.complete ? 1 : 0,
    )
}
