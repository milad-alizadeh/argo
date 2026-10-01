import { existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

// Waits while a proof's start-hold file exists; the proof releases the hold by deleting the file.
export async function waitWhileHoldFileExists(file: string | undefined) {
  while (file !== undefined && existsSync(file)) await sleep(20)
}
