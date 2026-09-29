import { expect, test } from 'bun:test'
import { readComposerCommands } from './composer-commands'

test('keeps a command row and counts a shape it cannot read', () => {
  const rejected: string[] = []
  const commands = readComposerCommands(
    [
      { name: 'implement', description: 'Build an approved ticket', argumentHint: '<ticket>' },
      { name: 'review', description: 'Read the diff', aliases: ['ship', ''] },
      { builtin: true },
      'implement',
    ],
    (shape) => rejected.push(shape),
  )
  expect(commands).toEqual([
    {
      name: 'implement',
      description: 'Build an approved ticket',
      argumentHint: '<ticket>',
      aliases: [],
    },
    {
      name: 'review',
      description: 'Read the diff',
      argumentHint: '',
      aliases: ['ship'],
    },
  ])
  expect(rejected).toEqual(['composer-command-alias', 'composer-command', 'composer-command'])
})

test('counts one rejection when the payload is not a list', () => {
  const rejected: string[] = []
  expect(
    readComposerCommands({ name: 'implement' } as never, (shape) => rejected.push(shape)),
  ).toEqual([])
  expect(rejected).toEqual(['composer-commands'])
})
