import { expect, test } from 'bun:test'
import type { ComposerCommandListing } from '@/domains/sessions/api/composer-commands'
import { referenceMenu, referenceMenuKey } from './composer-reference-menu'
import { referenceInText, referencesFromCommands } from './session-reference'

const review: ComposerCommandListing = {
  availability: 'listed',
  commands: [
    {
      name: 'review',
      description: 'Read the diff',
      argumentHint: '',
      aliases: ['ship'],
    },
  ],
}

test('offers a listed skill and hides a command the Harness did not list', () => {
  const menu = referenceMenu('Read /rev', review)
  expect(menu?.kind).toBe('choices')
  if (menu?.kind !== 'choices') return
  expect(menu.choices.map((choice) => choice.source)).toEqual(['/review'])
  expect(referenceMenu('/grill-me', review)).toEqual({ kind: 'note', note: 'empty' })
  expect(referenceMenu('@ENG-42', review)).toBeNull()
})

test('an alias filters to the same command', () => {
  const menu = referenceMenu('/shi', review)
  expect(menu?.kind).toBe('choices')
  if (menu?.kind !== 'choices') return
  expect(menu.choices[0]?.source).toBe('/review')
})

test('pending, empty and unavailable are notes, and a note does not take Enter', () => {
  expect(referenceMenu('/', { availability: 'pending', commands: [] })).toEqual({
    kind: 'note',
    note: 'pending',
  })
  expect(referenceMenu('/', { availability: 'listed', commands: [] })).toEqual({
    kind: 'note',
    note: 'empty',
  })
  expect(referenceMenu('/', { availability: 'unavailable', commands: [] })).toEqual({
    kind: 'note',
    note: 'unavailable',
  })
  const event = { key: 'Enter', shiftKey: false, preventDefault() {} } as KeyboardEvent
  expect(
    referenceMenuKey({
      choices: [],
      event,
      onChoose: () => {},
      onDismiss: () => {},
      onMove: () => {},
      selected: 0,
    }),
  ).toBe(false)
})

test('badges the published command and its alias, and not a retired file token', () => {
  const references = referencesFromCommands(review.commands)
  expect(referenceInText('see /review now', references)?.source).toBe('/review')
  expect(referenceInText('see /ship now', references)?.source).toBe('/ship')
  expect(referenceInText('see /implement now', references)).toBeNull()
  expect(referenceInText('see @AGENTS.md now', references)).toBeNull()
})
