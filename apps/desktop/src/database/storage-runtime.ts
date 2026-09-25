let packaged = false

export function configureStorageRuntime(isPackaged: boolean): void {
  packaged = isPackaged
}

export function storageRunsPackagedApplication(): boolean {
  return packaged
}
