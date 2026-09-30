// Every message catalog the renderer draws from, one namespace per module (#2130). A module that
// gains copy adds its `locales/en.json` and one line here, and nothing else changes.
//
// `platform` is the main process's own catalog, read here too: a shortcut named in the application
// menu and again on screen is one word from one file.
import { en as accounts } from '@/domains/accounts/renderer/locales'
import { en as atlas } from '@/domains/atlas/renderer/locales'
import { en as harnessSignIn } from '@/domains/harness-signin/renderer/locales'
import { en as projects } from '@/domains/projects/renderer/locales'
import { en as sessions } from '@/domains/sessions/renderer/locales'
import { en as tickets } from '@/domains/tickets/renderer/locales'
import { HARNESS_CATALOG as harnesses } from '@/harnesses/copy-registry'
import cockpit from '@/platform/renderer/cockpit/locales/en.json'
import shared from '@/platform/renderer/i18n/locales/en.json'
import platform from '@/platform/renderer/i18n/locales/en.json'
import { PROVIDER_CATALOG as providers } from '@/providers/copy-registry'

export const CATALOGS = {
  accounts,
  atlas,
  cockpit,
  harnessSignIn,
  harnesses,
  platform,
  projects,
  providers,
  sessions,
  shared,
  tickets,
} as const

export type Namespace = keyof typeof CATALOGS

export const DEFAULT_NAMESPACE = 'shared' satisfies Namespace
