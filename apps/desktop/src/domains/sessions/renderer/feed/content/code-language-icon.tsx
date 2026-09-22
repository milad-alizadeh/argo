import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import type { CodeLanguage } from './code-language'

export function CodeLanguageIcon({ language }: { language: CodeLanguage | null }) {
  const { t } = useTranslation('sessions')
  switch (language?.grammar) {
    case 'typescript':
    case 'tsx':
      return (
        <span className="grid size-5 place-items-center rounded-sm bg-language-typescript type-meta font-bold tracking-tighter text-language-typescript-ink">
          {t('codeLanguage.typescript')}
        </span>
      )
    case 'go':
      return (
        <span className="-skew-x-6 type-meta font-black tracking-tighter text-language-go">
          {t('codeLanguage.go')}
        </span>
      )
    case 'ruby':
      return (
        <Icon name="language-ruby" className="!size-5 fill-language-ruby/20 text-language-ruby" />
      )
    default:
      return <Icon name="language-generic" className="!size-(--size-icon-inline)" />
  }
}
