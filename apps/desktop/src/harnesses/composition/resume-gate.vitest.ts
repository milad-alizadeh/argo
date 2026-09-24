import { expect, test } from 'vitest'
import { createResumeGate } from './resume-gate'

test('two concurrent resume requests for one Session share one native open', async () => {
  const runResume = createResumeGate<string>()
  let release: (value: string) => void = () => {}
  const opening = new Promise<string>((resolve) => {
    release = resolve
  })
  let opens = 0
  const open = () => {
    opens += 1
    return opening
  }
  const first = runResume('claude:native-1', open)
  const second = runResume('claude:native-1', open)
  await Promise.resolve()
  expect(opens).toBe(1)
  release('managed')
  expect(await Promise.all([first, second])).toEqual(['managed', 'managed'])
  expect(await runResume('claude:native-1', async () => 'next turn')).toBe('next turn')
})
