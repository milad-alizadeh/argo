import { expect, test } from 'bun:test'
import { HARNESS_SIGN_IN_ERRORS } from '@/domains/harness-signin/contract/contract'
import harnessSignIn from '@/domains/harness-signin/renderer/locales/en.json'

test('the Harness sign-in catalog answers every Harness sign-in error code', () => {
  expect(Object.keys(harnessSignIn.error).sort()).toEqual(
    Object.keys(HARNESS_SIGN_IN_ERRORS).sort(),
  )
})
