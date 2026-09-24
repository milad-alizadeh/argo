export async function closeSessionResources(request: {
  stopNewWork: () => void
  waitForRecovery: () => Promise<void>
  closeAdapters: () => Promise<void>
  closeStores: () => void
}): Promise<void> {
  request.stopNewWork()
  try {
    await request.waitForRecovery()
  } finally {
    try {
      await request.closeAdapters()
    } finally {
      request.closeStores()
    }
  }
}
