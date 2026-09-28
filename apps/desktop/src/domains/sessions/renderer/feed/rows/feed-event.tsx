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
  liveStatus: 'event-status',
  liveFailure: 'event-status',
  permission: 'awaiting-permission',
  permissionGranted: 'awaiting-permission',
  permissionDenied: 'awaiting-permission',
  permissionCancelled: 'awaiting-permission',
  transcript: 'event-transcript',
  'skill-invocation': 'skill-invocation',
} satisfies Record<FeedEventRow['event'], IconName>

const LIVE_STATUS_KEYS = {
  starting: 'events.liveStatus.starting',
  running: 'events.liveStatus.running',
  permission: 'events.liveStatus.permission',
  asking: 'events.liveStatus.asking',
  idle: 'events.liveStatus.idle',
  stopped: 'events.liveStatus.stopped',
  ended: 'events.liveStatus.ended',
  unknown: 'events.liveStatus.unknown',
} as const

function isLiveStatus(value: string): value is keyof typeof LIVE_STATUS_KEYS {
  return Object.hasOwn(LIVE_STATUS_KEYS, value)
}

export function FeedEvent({ row }: { row: FeedEventRow }) {
  const { t } = useTranslation('sessions')
  const label = t(`events.${row.event}.label`)
  const text =
    row.event === 'liveStatus' && row.text !== null && isLiveStatus(row.text)
      ? t(LIVE_STATUS_KEYS[row.text])
      : row.text
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
      {text === null ? null : (
        <span className="min-w-0 break-words text-muted-foreground">{text}</span>
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
