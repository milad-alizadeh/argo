import { describe, expect, test } from 'bun:test'
import { createWatchClient } from '../preload/watch'
import { isWatchTopic } from './watch'

// A client wired to a subscription the test drives itself, standing in for the IPC channel the
// preload world hands it.
function listening() {
  const heard: string[] = []
  let send: (topic: unknown) => void = () => {}
  let disposed = false
  const client = createWatchClient((listener) => {
    send = listener
    return () => {
      disposed = true
    }
  })
  const dispose = client.onWatchedChanged((topic) => heard.push(topic))
  return { dispose, heard, isDisposed: () => disposed, send: (topic: unknown) => send(topic) }
}

describe('the watch client', () => {
  test('reports a change to the renderer under the topic the main process named', () => {
    const watch = listening()
    watch.send('sessions')
    expect(watch.heard).toEqual(['sessions'])
  })

  test('says nothing for a value that names no topic', () => {
    const watch = listening()
    watch.send('tickets')
    watch.send(null)
    watch.send(7)
    expect(watch.heard).toEqual([])
  })

  test('hands back the disposer that ends the subscription', () => {
    const watch = listening()
    watch.dispose()
    expect(watch.isDisposed()).toBe(true)
  })

  test('recognises only the topics the app watches', () => {
    expect(isWatchTopic('sessions')).toBe(true)
    expect(isWatchTopic('everything')).toBe(false)
  })
})
