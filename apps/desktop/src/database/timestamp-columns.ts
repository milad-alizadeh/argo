import { sql } from 'drizzle-orm'
import { integer } from 'drizzle-orm/sqlite-core'

function currentTimestampMilliseconds() {
  return sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`
}

export function timestampColumns() {
  return {
    createdAt: integer('created_at').notNull().default(currentTimestampMilliseconds()),
    updatedAt: integer('updated_at').notNull().default(currentTimestampMilliseconds()),
  }
}
