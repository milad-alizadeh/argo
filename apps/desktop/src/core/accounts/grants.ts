// The grant store: each Account's token, encrypted by the operating system's key through Electron
// `safeStorage` and kept in an app-owned file (#1763). No native keychain module, and the old Swift
// keychain items are neither read nor deleted.
import { isRecord } from '../../boundary'
import { readDocument, writeDocument } from '../storage/portable-file'

// Electron's `safeStorage`, reduced to what the store calls, so the store runs without Electron.
export type Cipher = {
  available(): boolean
  encrypt(text: string): Buffer
  decrypt(data: Buffer): string
}

export type StoredGrant = { accessToken: string; scopes: string[] }

export type GrantRead =
  | { ok: true; grant: StoredGrant }
  | { ok: false; reason: 'missing' | 'unreadable' }

type Sealed = Record<string, string>

// Only this user may read the file, though what it holds is ciphertext.
const PRIVATE = 0o600

async function readSealed(grantsPath: string): Promise<Sealed | null> {
  const read = await readDocument(grantsPath)
  if (!read.ok) return read.reason === 'missing' ? {} : null
  const document = read.document
  if (!isRecord(document) || document.version !== 1 || !isRecord(document.grants)) return null
  const entries = Object.entries(document.grants)
  return Object.fromEntries(entries.filter(([, sealed]) => typeof sealed === 'string')) as Sealed
}

function unseal(cipher: Cipher, sealed: string): StoredGrant | null {
  try {
    const grant: unknown = JSON.parse(cipher.decrypt(Buffer.from(sealed, 'base64')))
    if (!isRecord(grant) || typeof grant.accessToken !== 'string' || !grant.accessToken) return null
    const scopes = Array.isArray(grant.scopes)
      ? grant.scopes.filter((s) => typeof s === 'string')
      : []
    return { accessToken: grant.accessToken, scopes }
  } catch {
    return null
  }
}

export function createGrantStore(grantsPath: string, cipher: Cipher) {
  const write = (grants: Sealed) => writeDocument(grantsPath, { version: 1, grants }, PRIVATE)

  return {
    available: () => cipher.available(),

    async read(accountId: string): Promise<GrantRead> {
      const sealed = await readSealed(grantsPath)
      if (!sealed) return { ok: false, reason: 'unreadable' }
      const entry = sealed[accountId]
      if (entry === undefined) return { ok: false, reason: 'missing' }
      const grant = cipher.available() ? unseal(cipher, entry) : null
      return grant ? { ok: true, grant } : { ok: false, reason: 'unreadable' }
    },

    async save(accountId: string, grant: StoredGrant): Promise<boolean> {
      const sealed = await readSealed(grantsPath)
      if (!sealed || !cipher.available()) return false
      try {
        const entry = cipher.encrypt(JSON.stringify(grant)).toString('base64')
        return await write({ ...sealed, [accountId]: entry })
      } catch {
        return false
      }
    },

    async remove(accountId: string): Promise<boolean> {
      const sealed = await readSealed(grantsPath)
      if (!sealed) return false
      const { [accountId]: _removed, ...rest } = sealed
      return write(rest)
    },
  }
}

export type GrantStore = ReturnType<typeof createGrantStore>
