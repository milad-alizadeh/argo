export function startProjectSetupActorTask(task: () => Promise<void>): () => void {
  let active = true
  void Promise.resolve().then(async () => {
    if (active) await task()
  })
  return () => {
    active = false
  }
}
