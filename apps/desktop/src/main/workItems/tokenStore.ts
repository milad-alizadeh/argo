import { readFile, writeFile } from 'node:fs/promises'
import { safeStorage } from 'electron'

// Where a provider token lives: PER-MACHINE, encrypted by the OS (ADR-0018). `safeStorage` is
// the portable spelling of "the OS keychain" and also the Linux fallback story — it reports
// when no backend exists, so a machine with none holds no token rather than one in the clear.

export interface TokenStore {
  read(): Promise<string | null>
  write(token: string): Promise<boolean>
}

/** A store backed by the OS. `file` is a path in per-machine `userData`; only the CIPHERTEXT
 * lands there, and the key that opens it stays in the keychain. */
export function createTokenStore(file: string): TokenStore {
  return {
    async read() {
      if (!safeStorage.isEncryptionAvailable()) return null
      try {
        return safeStorage.decryptString(await readFile(file))
      } catch {
        // No file yet, or ciphertext this machine's key no longer opens. Either way there is
        // no token — which re-enters the connect panel rather than failing the launch.
        return null
      }
    },
    async write(token) {
      if (!safeStorage.isEncryptionAvailable()) return false
      try {
        await writeFile(file, safeStorage.encryptString(token))
        return true
      } catch {
        return false
      }
    },
  }
}
