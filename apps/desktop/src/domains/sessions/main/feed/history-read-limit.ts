// A Feed's main reader and its open Subagent's reader can read together; more only queue.
export const HISTORY_READ_SLOTS = 2

type Waiter = { start: () => void; signal: AbortSignal | undefined; abort: () => void }

// The one limit on vendor history reads, shared by every Feed and by uncertain-command recovery.
// A vendor read takes no signal, so a started read keeps its slot until it ends; a signal only
// takes a read out of the queue.
export class HistoryReadLimit {
  readonly #queue: Waiter[] = []
  #running = 0

  run<T>(read: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(signal.reason)
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.#running += 1
        void (async () => read())()
          .then(resolve, reject)
          .finally(() => {
            this.#running -= 1
            this.#next()
          })
      }
      if (this.#running < HISTORY_READ_SLOTS) return start()
      const waiter: Waiter = {
        start,
        signal,
        abort: () => {
          this.#queue.splice(this.#queue.indexOf(waiter), 1)
          reject(signal?.reason)
        },
      }
      signal?.addEventListener('abort', waiter.abort, { once: true })
      this.#queue.push(waiter)
    })
  }

  #next(): void {
    const waiter = this.#queue.shift()
    if (waiter === undefined) return
    waiter.signal?.removeEventListener('abort', waiter.abort)
    waiter.start()
  }
}
