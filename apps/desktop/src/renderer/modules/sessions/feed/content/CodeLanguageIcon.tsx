import { FileCode2, Gem } from 'lucide-react'
import type { CodeLanguage } from './codeLanguage'

export function CodeLanguageIcon({ language }: { language: CodeLanguage | null }) {
  switch (language?.grammar) {
    case 'typescript':
    case 'tsx':
      return (
        <span className="grid size-5 place-items-center rounded-sm bg-language-typescript type-meta font-bold tracking-tighter text-language-typescript-ink">
          TS
        </span>
      )
    case 'go':
      return (
        <span className="-skew-x-6 type-meta font-black tracking-tighter text-language-go">GO</span>
      )
    case 'ruby':
      return <Gem className="!size-5 fill-language-ruby/20 text-language-ruby" />
    default:
      return <FileCode2 className="!size-(--size-icon-inline)" />
  }
}
