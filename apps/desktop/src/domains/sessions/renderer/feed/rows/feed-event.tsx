import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import { SessionSkillBody } from '../../inspector/session-skill-inspector'
import type { SessionFeedRow } from '../../types'
import { CollapsibleText } from '../tools/collapsible-text'

type FeedEventRow = Extract<SessionFeedRow, { shape: 'event' }>

const EVENT_PRESENTATION = {
  command: 'event-command',
  context: 'event-context',
  status: 'event-status',
  transcript: 'event-transcript',
  'skill-invocation': 'skill-invocation',
} satisfies Record<FeedEventRow['event'], IconName>

export function FeedEvent({ row }: { row: FeedEventRow }) {
  const { t } = useTranslation('sessions')
  const label = t(`events.${row.event}.label`)
  if (row.event === 'skill-invocation' && row.skill !== undefined)
    return (
      <div className="rounded-md bg-muted/60 px-2.5 py-1.5" data-slot="feed-event">
        <CollapsibleText
          content={<SessionSkillBody path={row.skill.path} />}
          contentVariant="flush"
          icon={EVENT_PRESENTATION[row.event]}
          title={t(`events.${row.event}.title`, { label, invocation: row.text ?? '' })}
        />
        {row.raw == null ? null : (
          <details className="ml-auto shrink-0">
            <summary className="cursor-pointer text-muted-foreground">
              {t('events.protocolDetails')}
            </summary>
            <pre className="mt-1 whitespace-pre-wrap break-words type-meta">{row.raw}</pre>
          </details>
        )}
      </div>
    )
  return (
    <div
      className="flex min-w-0 items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 type-body"
      data-slot="feed-event"
    >
      <Icon
        className="shrink-0 text-muted-foreground"
        name={EVENT_PRESENTATION[row.event]}
        size="control"
      />
      <span className="shrink-0 font-medium text-foreground">{label}</span>
      {row.text === null ? null : (
        <span className="min-w-0 break-words text-muted-foreground">{row.text}</span>
      )}
      {row.raw == null ? null : (
        <details className="ml-auto shrink-0">
          <summary className="cursor-pointer text-muted-foreground">
            {t('events.protocolDetails')}
          </summary>
          <pre className="mt-1 whitespace-pre-wrap break-words type-meta">{row.raw}</pre>
        </details>
      )}
    </div>
  )
}
