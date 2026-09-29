import { expect, test } from 'bun:test'
import { listComposerCommandsFor } from './session-composer-commands'

test('a Harness that lists commands returns that list', async () => {
  await expect(
    listComposerCommandsFor(
      {
        listCommands: async () => ({ availability: 'listed', commands: [] }),
        openLiveSession: () => {
          throw new Error('unused')
        },
      },
      '/repo',
    ),
  ).resolves.toEqual({ availability: 'listed', commands: [] })
})

test('a Harness that lists only from a live Session stays pending', async () => {
  await expect(
    listComposerCommandsFor({ openLiveSession: () => undefined }, null),
  ).resolves.toEqual({ availability: 'pending', commands: [] })
})

test('a Harness with no command source is unavailable', async () => {
  await expect(listComposerCommandsFor({}, null)).resolves.toEqual({
    availability: 'unavailable',
    commands: [],
  })
})
