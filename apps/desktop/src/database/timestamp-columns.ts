import { type SQL, sql } from 'drizzle-orm'
import { integer, type SQLiteColumn } from 'drizzle-orm/sqlite-core'

function currentTimestampMilliseconds(): SQL<number> {
  return sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`
}

export function updatedAtColumn() {
  return integer('updated_at').notNull().default(currentTimestampMilliseconds())
}

export function timestampColumns() {
  return {
    createdAt: integer('created_at').notNull().default(currentTimestampMilliseconds()),
    updatedAt: updatedAtColumn(),
  }
}

// A write's `updated_at`: now, and always later than the value it replaces.
export function nextUpdatedAt(column: SQLiteColumn): SQL<number> {
  return sql`MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), ${column} + 1)`
}
