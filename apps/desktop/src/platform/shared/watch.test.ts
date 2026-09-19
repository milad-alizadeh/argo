import { describe, expect, test } from 'bun:test'
import { createWatchClient } from '../preload/watch'
import { isWatchTopic, type WatchTopic } from './watch'

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

  test('shares one source subscription between renderer listeners', () => {
    const heard: string[] = []
    let send: (topic: unknown) => void = () => {}
    let subscribed = 0
    let disposed = 0
    const client = createWatchClient((listener) => {
      subscribed += 1
      send = listener
      return () => {
        disposed += 1
      }
    })

    const disposeFirst = client.onWatchedChanged((topic) => heard.push(`first:${topic}`))
    const disposeSecond = client.onWatchedChanged((topic) => heard.push(`second:${topic}`))

    expect(subscribed).toBe(1)
    send('sessions')
    expect(heard).toEqual(['first:sessions', 'second:sessions'])
    disposeFirst()
    expect(disposed).toBe(0)
    disposeSecond()
    expect(disposed).toBe(1)
  })

  test('recognises only the topics the app watches', () => {
    expect(isWatchTopic('sessions')).toBe(true)
    expect(isWatchTopic('everything')).toBe(false)
  })
})

describe('duplicate watch callbacks', () => {
  test('keep their registrations independent', () => {
    const heard: string[] = []
    let send: (topic: unknown) => void = () => {}
    const client = createWatchClient((listener) => {
      send = listener
      return () => {}
    })
    const listener = (topic: WatchTopic) => heard.push(topic)

    const disposeFirst = client.onWatchedChanged(listener)
    const disposeSecond = client.onWatchedChanged(listener)
    send('sessions')

    expect(heard).toEqual(['sessions', 'sessions'])
    disposeFirst()
    send('sessions')
    expect(heard).toEqual(['sessions', 'sessions', 'sessions'])
    disposeSecond()
  })
})
