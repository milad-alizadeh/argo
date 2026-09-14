import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SHORTCUTS } from '../commands/shortcuts'
import en from './locales/en.json'
import { platformText, setPlatformLanguage } from './platform'

function leafKeys(catalog: object, prefix: string): string[] {
  return Object.entries(catalog).flatMap(([segment, value]) =>
    typeof value === 'string'
      ? [`${prefix}.${segment}`]
      : leafKeys(value as object, `${prefix}.${segment}`),
  )
}

const shortcutKeys = leafKeys(en.shortcut, 'shortcut')

test('every shortcut names a label the catalog holds', () => {
  const declared = SHORTCUTS.map((entry) => entry.labelKey).sort()
  assert.deepEqual(declared, shortcutKeys.sort())
})

test('a language with no catalog is drawn in English', () => {
  setPlatformLanguage('fr-CA')
  assert.equal(platformText('dialog.openProject.title'), 'Open Project')
  setPlatformLanguage('en')
})

test('a region variant reads its base language', () => {
  setPlatformLanguage('en-GB')
  assert.equal(platformText('dialog.attachFiles.confirm'), 'Attach')
  setPlatformLanguage('en')
})

test('an undeclared key is a failure rather than a blank label', () => {
  assert.throws(
    () => platformText('dialog.openProject.subtitle' as Parameters<typeof platformText>[0]),
    /No platform text is declared/,
  )
})
