import { FileCode2, Gem } from 'lucide-react'

export type CodeLanguage = 'go' | 'ruby' | 'typescript' | 'unknown'

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
  go: 'go',
  golang: 'go',
  rb: 'ruby',
  ruby: 'ruby',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
}

export function detectCodeLanguage(source: string, language?: string): CodeLanguage {
  if (language) return LANGUAGE_ALIASES[language.toLowerCase()] ?? 'unknown'
  if (/^\s*(?:package\s+\w+|func\s+\w+\s*\()/m.test(source)) return 'go'
  if (/^\s*(?:class|def|module|require)\b/m.test(source) && /^\s*end\s*$/m.test(source))
    return 'ruby'
  if (/\b(?:interface|type)\s+[A-Z]\w*|:\s*[A-Z]\w*(?:<[^>]+>)?|<\/?[A-Z][\w.]*/m.test(source))
    return 'typescript'
  return 'unknown'
}

export function codeLanguageLabel(language: CodeLanguage) {
  return {
    go: 'Go',
    ruby: 'Ruby',
    typescript: 'TypeScript',
    unknown: 'Code',
  }[language]
}

export function CodeLanguageIcon({ language }: { language: CodeLanguage }) {
  switch (language) {
    case 'typescript':
      return (
        <span className="grid size-5 place-items-center rounded-sm bg-sky-600 type-meta font-bold tracking-tighter text-white">
          TS
        </span>
      )
    case 'go':
      return (
        <span className="-skew-x-6 type-meta font-black tracking-tighter text-cyan-600 dark:text-cyan-400">
          GO
        </span>
      )
    case 'ruby':
      return <Gem className="!size-5 fill-red-600/20 text-red-600 dark:text-red-400" />
    case 'unknown':
      return <FileCode2 className="!size-(--size-icon-inline)" />
  }
}
