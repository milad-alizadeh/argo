// Every message catalog the renderer draws from, one namespace per module (#2130). A module that
// gains copy adds its `locales/en.json` and one line here, and nothing else changes.
//
// `platform` is the main process's own catalog, read here too: a shortcut named in the application
// menu and again on screen is one word from one file.
import platform from '../../core/i18n/locales/en.json'
import accounts from '../modules/accounts/locales/en.json'
import atlas from '../modules/atlas/locales/en.json'
import sessions from '../modules/sessions/locales/en.json'
import tickets from '../modules/tickets/locales/en.json'
import shared from './locales/en.json'

export const CATALOGS = { accounts, atlas, platform, sessions, shared, tickets } as const

export type Namespace = keyof typeof CATALOGS

export const DEFAULT_NAMESPACE = 'shared' satisfies Namespace
