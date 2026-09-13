import { type BundledLanguage, bundledLanguages, bundledLanguagesInfo } from 'shiki'

// A fence language Argo can highlight. Anything else is `null`, which draws as plain code.
export type CodeLanguage = { grammar: BundledLanguage; label: string }

function isBundled(id: string): id is BundledLanguage {
  return Object.hasOwn(bundledLanguages, id)
}

const LANGUAGES = new Map<string, CodeLanguage>(
  bundledLanguagesInfo.flatMap((info) => {
    if (!isBundled(info.id)) return []
    const language = { grammar: info.id, label: info.name }
    return [info.id, ...(info.aliases ?? [])].map((name) => [name.toLowerCase(), language] as const)
  }),
)

function languageNamed(name: string): CodeLanguage | null {
  return LANGUAGES.get(name.toLowerCase()) ?? null
}

// The fence's own word wins; an unlabelled fence is guessed only among the prototype's three.
export function detectCodeLanguage(source: string, language?: string): CodeLanguage | null {
  if (language) return languageNamed(language)
  if (/^\s*(?:package\s+\w+|func\s+\w+\s*\()/m.test(source)) return languageNamed('go')
  if (/^\s*(?:class|def|module|require)\b/m.test(source) && /^\s*end\s*$/m.test(source))
    return languageNamed('ruby')
  if (/\b(?:interface|type)\s+[A-Z]\w*|:\s*[A-Z]\w*(?:<[^>]+>)?|<\/?[A-Z][\w.]*/m.test(source))
    return languageNamed('typescript')
  return null
}

export function codeLanguageLabel(language: CodeLanguage | null) {
  return language?.label ?? 'Code'
}
