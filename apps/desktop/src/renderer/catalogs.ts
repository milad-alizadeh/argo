// Every message catalog the renderer draws from, one namespace per module (#2130). A module that
// gains copy adds its `locales/en.json` and one line here, and nothing else changes.
//
// `platform` is the main process's own catalog, read here too: a shortcut named in the application
// menu and again on screen is one word from one file.
import accounts from '@/domains/accounts/renderer/locales/en.json'
import atlas from '@/domains/atlas/renderer/locales/en.json'
import harnessSignIn from '@/domains/harness-signin/renderer/locales/en.json'
import projects from '@/domains/projects/renderer/locales/en.json'
import sessions from '@/domains/sessions/renderer/locales/en.json'
import tickets from '@/domains/tickets/renderer/locales/en.json'
import cockpit from '@/platform/renderer/cockpit/locales/en.json'
import shared from '@/platform/renderer/i18n/locales/en.json'
import platform from '@/platform/renderer/i18n/locales/en.json'

export const CATALOGS = {
  accounts,
  atlas,
  cockpit,
  harnessSignIn,
  platform,
  projects,
  sessions,
  shared,
  tickets,
} as const

export type Namespace = keyof typeof CATALOGS

export const DEFAULT_NAMESPACE = 'shared' satisfies Namespace
