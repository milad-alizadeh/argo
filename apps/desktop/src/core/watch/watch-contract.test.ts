import { describe, expect, test } from 'bun:test'
import { createWatchClient, isWatchTopic } from './watch-contract'

describe('the watch client', () => {
  test('reports a change to the renderer under the topic the main process named', () => {
    let send: (topic: unknown) => void = () => {}
    const client = createWatchClient((listener) => {
      send = listener
      return () => {}
    })
    const heard: string[] = []
    client.onWatchedChanged((topic) => heard.push(topic))
    send('sessions')
    expect(heard).toEqual(['sessions'])
  })

  test('says nothing for a value that names no topic', () => {
    let send: (topic: unknown) => void = () => {}
    const client = createWatchClient((listener) => {
      send = listener
      return () => {}
    })
    const heard: string[] = []
    client.onWatchedChanged((topic) => heard.push(topic))
    send('tickets')
    send(null)
    send(7)
    expect(heard).toEqual([])
  })

  test('hands back the disposer that ends the subscription', () => {
    let disposed = false
    const client = createWatchClient(() => () => {
      disposed = true
    })
    client.onWatchedChanged(() => {})()
    expect(disposed).toBe(true)
  })

  test('recognises only the topics the app watches', () => {
    expect(isWatchTopic('sessions')).toBe(true)
    expect(isWatchTopic('everything')).toBe(false)
  })
})
