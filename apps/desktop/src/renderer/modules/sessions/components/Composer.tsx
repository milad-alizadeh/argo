import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import {
  ArrowUpIcon,
  ChevronDownIcon,
  GaugeIcon,
  HandIcon,
  ImageIcon,
  MicIcon,
  PaperclipIcon,
  PlusIcon,
  SquareIcon,
  Trash2Icon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Session } from '../types'

const EDITOR_CONFIG = {
  namespace: 'session-composer',
  onError(error: Error) {
    throw error
  },
}

export type ComposerContent = {
  queued: readonly string[]
  attachments: readonly { name: string; kind: string }[]
  usagePercentage: number | null
  contextUsed: number | null
  contextTotal: number | null
  runLabel: string | null
  modeLabel: string | null
}

export function Composer({ session, content }: { session: Session; content?: ComposerContent }) {
  return (
    <>
      <ComposerAttention session={session} />
      <ComposerQueue content={content} />
      <ComposerForm content={content} session={session} />
      <ContextBar content={content} />
    </>
  )
}

function ComposerQueue({ content }: { content?: ComposerContent }) {
  const { t } = useTranslation()
  if (!content?.queued.length) return null
  return (
    <div className="session-page__composer-queue" data-component="ComposerQueue">
      {content.queued.map((message) => (
        <div className="session-page__queued-message" data-component="QueuedMessage" key={message}>
          <span className="truncate">{message}</span>
          <IconButton label={t('composer.removeQueued')}>
            <Trash2Icon />
          </IconButton>
        </div>
      ))}
    </div>
  )
}

function ComposerForm({ session, content }: { session: Session; content?: ComposerContent }) {
  const { t } = useTranslation()
  return (
    <form aria-label={t('composer.label')} data-component="Composer">
      <AttachmentTray content={content} />
      {session.plan === null ? null : (
        <button className="session-page__plan-pill" data-component="PlanPill" type="button">
          {t('composer.plan', {
            current: Math.min(session.plan.total, session.plan.completed + 1),
            total: session.plan.total,
          })}
        </button>
      )}
      <LexicalComposer initialConfig={EDITOR_CONFIG}>
        <PlainTextPlugin
          ErrorBoundary={LexicalErrorBoundary}
          contentEditable={
            <ContentEditable
              aria-label={t('composer.message')}
              className="session-page__composer-field"
              data-component="ComposerField"
            />
          }
          placeholder={
            <span className="session-page__composer-placeholder">{t('composer.placeholder')}</span>
          }
        />
      </LexicalComposer>
      <ComposerFooter content={content} session={session} />
    </form>
  )
}

function AttachmentTray({ content }: { content?: ComposerContent }) {
  if (!content?.attachments.length) return null
  return (
    <div className="session-page__attachment-tray" data-component="AttachmentTray">
      {content.attachments.map((attachment) => (
        <div
          className="session-page__attachment"
          data-component="AttachmentCard"
          key={attachment.name}
        >
          <span className="session-page__attachment-thumb">
            <ImageIcon />
          </span>
          <span className="min-w-0">
            <b className="block truncate">{attachment.name}</b>
            <span>{attachment.kind}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function ComposerFooter({ session, content }: { session: Session; content?: ComposerContent }) {
  const { t } = useTranslation()
  const running = session.status === 'running' || session.status === 'starting'
  return (
    <footer className="session-page__composer-footer" data-component="ComposerFooter">
      <IconButton label={t('composer.addContext')}>
        <PlusIcon />
      </IconButton>
      {content?.runLabel ? (
        <button
          className="session-page__composer-control"
          data-component="RunSettings"
          type="button"
        >
          <span className="label">{content.runLabel}</span>
          <ChevronDownIcon />
        </button>
      ) : null}
      <span className="flex-1" />
      {content?.modeLabel ? (
        <button
          className="session-page__composer-control"
          data-component="ModeControl"
          type="button"
        >
          <HandIcon />
          <span>{content.modeLabel}</span>
          <ChevronDownIcon />
        </button>
      ) : null}
      <IconButton label={t('composer.attach')}>
        <PaperclipIcon />
      </IconButton>
      <IconButton label={t('composer.dictate')}>
        <MicIcon />
      </IconButton>
      <button
        aria-label={running ? t('composer.interrupt') : t('composer.send')}
        className="session-page__send"
        data-component="SendButton"
        type="button"
      >
        {running ? <SquareIcon /> : <ArrowUpIcon />}
      </button>
    </footer>
  )
}

function ContextBar({ content }: { content?: ComposerContent }) {
  const { t } = useTranslation()
  return (
    <div className="session-page__context-bar" data-component="ContextBar">
      <span className="session-page__context-fact">
        <GaugeIcon />
        <span className="label">{t('composer.usage')}</span>
        {content?.usagePercentage === null || content?.usagePercentage === undefined ? null : (
          <b>{content.usagePercentage}%</b>
        )}
      </span>
      {content?.contextUsed === null ||
      content?.contextUsed === undefined ||
      content.contextTotal === null ? null : (
        <span className="session-page__context-fact">
          <span className="label">{t('composer.context')}</span>
          <b>{content.contextUsed}k</b> / {content.contextTotal}k
        </span>
      )}
      <span className="flex-1" />
      <IconButton label={t('composer.compact')}>
        <SquareIcon />
      </IconButton>
      <IconButton label={t('composer.handoff')}>
        <HandIcon />
      </IconButton>
    </div>
  )
}

function ComposerAttention({ session }: { session: Session }) {
  const { t } = useTranslation()
  if (session.status !== 'permission' && session.status !== 'asking') return null
  const question = session.status === 'asking'
  return (
    <section
      className="session-page__composer-attention"
      data-component={question ? 'ComposerQuestion' : 'ComposerPermission'}
    >
      <strong>{t(question ? 'composer.question' : 'composer.permission')}</strong>
      {session.activity?.target === null || session.activity === null ? null : (
        <span className="truncate font-mono text-control">{session.activity.target}</span>
      )}
      <div className="session-page__attention-actions">
        <button className="session-page__outline-button" type="button">
          {t(question ? 'composer.skip' : 'composer.deny')}
        </button>
        <button className="session-page__primary-button" type="button">
          {t(question ? 'composer.answer' : 'composer.allow')}
        </button>
      </div>
    </section>
  )
}

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button aria-label={label} className="session-page__icon-button" type="button">
      {children}
    </button>
  )
}
