import { type BundledLanguage, bundledLanguages, bundledLanguagesInfo } from 'shiki/langs'

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

function isJson(source: string): boolean {
  const trimmed = source.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

function guessedLanguage(source: string): string | null {
  if (isJson(source)) return 'json'
  if (
    /^\s*(?:#!.*\b(?:ba)?sh\b|set\s+-[a-z]+\b|(?:npm|bun|pnpm|yarn|git|docker)\s+\S+)/m.test(source)
  )
    return 'bash'
  if (
    /^\s*(?:def\s+\w+\s*\(|class\s+\w+\s*(?:\([^)]*\))?\s*:|if\s+__name__\s*==|from\s+[\w.]+\s+import\b|import\s+[\w.]+\s*$)/m.test(
      source,
    )
  )
    return 'python'
  if (/^\s*(?:package\s+\w+|func\s+\w+\s*\()/m.test(source)) return 'go'
  if (/^\s*(?:fn\s+\w+\s*\(|let\s+mut\s+\w+\s*=)/m.test(source)) return 'rust'
  if (/^\s*(?:class|def|module|require)\b/m.test(source) && /^\s*end\s*$/m.test(source))
    return 'ruby'
  if (/^\s*(?:#include\s*[<"]|int\s+main\s*\()/m.test(source)) return 'cpp'
  if (/\b(?:interface|type)\s+[A-Z]\w*|:\s*[A-Z]\w*(?:<[^>]+>)?|<\/?[A-Z][\w.]*/m.test(source))
    return 'typescript'
  if (
    /^\s*(?:const|let|var)\s+[\w$]+\s*=|^\s*function\s+[\w$]+\s*\(|^\s*import\s+.*\s+from\s+['"]|=>/m.test(
      source,
    )
  )
    return 'javascript'
  if (
    /^\s*(?:SELECT\b.*\bFROM\b|INSERT\s+INTO\b|UPDATE\s+\w+\s+SET\b|CREATE\s+TABLE\b)/im.test(
      source,
    )
  )
    return 'sql'
  if (
    /^\s*(?:@(?:media|supports|keyframes|import)\b|(?:[.#][\w-]+|[a-z][\w-]*)\s*\{)/im.test(source)
  )
    return 'css'
  return null
}

// An explicit fence label wins; otherwise a distinctive source shape supplies a likely language.
export function detectCodeLanguage(source: string, language?: string): CodeLanguage | null {
  if (language) return languageNamed(language)
  const guess = guessedLanguage(source)
  return guess === null ? null : languageNamed(guess)
}

// A File's suffix is the declared language for an inspector. Unlike a fence, a File does not
// need a content guess: an unknown suffix stays plain text rather than borrowing a language.
export function detectCodeLanguageFromPath(filePath: string): CodeLanguage | null {
  const suffix = filePath.split('/').at(-1)?.split('.').at(-1)
  return suffix === undefined || suffix === filePath ? null : languageNamed(suffix)
}

export function codeLanguageLabel(language: CodeLanguage | null) {
  return language?.label ?? 'Code'
}
