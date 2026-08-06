import { readFile, writeFile } from 'node:fs/promises'
import { safeStorage } from 'electron'

// Where a provider token lives: PER-MACHINE, encrypted by the OS (ADR-0018) — never in the
// repo, never in a plain file. Electron's `safeStorage` is the portable spelling of "the OS
// keychain": macOS Keychain, DPAPI on Windows, and libsecret/kwallet on Linux where a keyring
// exists. It is also the whole of the Linux fallback story ADR-0018 asks for — `safeStorage`
// reports when no backend is available, and a machine with none simply cannot hold a token,
// which is an honest "not connected" rather than a token written in the clear.
//
// The interface is separate from the Electron-backed implementation so the flow above it is
// node-testable: a suite supplies a store in memory and never touches a keychain.

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

/** A store that holds nothing, for a machine with no keychain backend. Reading returns no
 * token and writing refuses, so the caller reports "not connected" rather than pretending. */
export function nullTokenStore(): TokenStore {
  return {
    read: () => Promise.resolve(null),
    write: () => Promise.resolve(false),
  }
}
