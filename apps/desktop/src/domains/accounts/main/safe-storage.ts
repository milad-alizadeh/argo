// Electron's `safeStorage` as the grant store's cipher (#1763). On Linux with no keyring, Chromium
// falls back to a hard-coded key, which is not secure storage, so that backend counts as absent.
import { safeStorage } from 'electron'
import type { Cipher } from './grants'

export const safeStorageCipher: Cipher = {
  available: () =>
    safeStorage.isEncryptionAvailable() &&
    !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text'),
  encrypt: (text) => safeStorage.encryptString(text),
  decrypt: (data) => safeStorage.decryptString(data),
}
