import type { SetupDocument } from './setup-document'

export function setupLocale(document: SetupDocument, language: string) {
  const locale = document.locales[language] ?? document.locales.en
  if (!locale) throw new Error('Setup document must provide an English locale.')
  return locale
}

export function setupFieldText(document: SetupDocument, language: string, id: string) {
  const locale = setupLocale(document, language)
  const text = locale.fields[id] ?? document.locales.en?.fields[id]
  if (!text) throw new Error(`Setup document is missing field text for ${id}.`)
  return text
}

export function setupPlanText(document: SetupDocument, language: string, id: string) {
  const locale = setupLocale(document, language)
  const text = locale.plan[id] ?? document.locales.en?.plan[id]
  if (!text) throw new Error(`Setup document is missing plan text for ${id}.`)
  return text
}

export function setupChoiceText(
  document: SetupDocument,
  language: string,
  choice: { fieldId: string; value: string },
) {
  const locale = setupLocale(document, language)
  const text =
    locale.fields[choice.fieldId]?.choices[choice.value] ??
    document.locales.en?.fields[choice.fieldId]?.choices[choice.value]
  if (!text) {
    throw new Error(`Setup document is missing choice text for ${choice.fieldId}.${choice.value}.`)
  }
  return text
}
