import { drizzle } from 'drizzle-orm/node-sqlite'

export const createDurableDatabase = (client: import('node:sqlite').DatabaseSync) =>
  drizzle({ client })

export type DurableDatabase = Omit<ReturnType<typeof createDurableDatabase>, '$client'> & {
  $client: { close: () => void }
}
