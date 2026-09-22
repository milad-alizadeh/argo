import { Progress } from '@/platform/renderer/components/ui/progress'

const COMPOSITION = [
  { label: 'Conversation', percentage: 71, value: '86k' },
  { label: 'System prompt', percentage: 13, value: '16k' },
  { label: 'MCP tools', percentage: 8, value: '10k' },
  { label: 'Memory files', percentage: 5, value: '6k' },
  { label: 'Skills', percentage: 3, value: '3k' },
]

export function ClaudeContextComposition() {
  const { t } = useTranslation('sessions')
  return (
    <div className="type-body">
      <div className="font-medium">{t('composer.contextWindow.loadedContext')}</div>
      <div className="mt-2 grid gap-2">
        {COMPOSITION.map((item) => (
          <div
            className="grid grid-cols-[var(--size-context-label-column)_1fr_var(--size-control)] items-center gap-2"
            key={item.label}
          >
            <span className="text-muted-foreground">{item.label}</span>
            <Progress aria-label={item.label} className="h-1.5" value={item.percentage} />
            <span className="text-right tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
