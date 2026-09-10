import { ChevronRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { readDelegation } from '../../../../core/sessions/delegation'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../components/ui/collapsible'
import type { Session } from '../types'

import { SessionStateDot } from './SessionStatus'

function Chip({ children }: { children: ReactNode }) {
  return (
    <li className="mb-1 flex min-w-0 items-center gap-tight rounded-(--radius-row) p-tight hover:bg-accent/50">
      {children}
    </li>
  )
}

// One line, one number: what is running under this Session now. A section header counts the live
// work only, so a header that says nothing is running is the truth even when the Session has a
// hundred finished Subagents behind it (#1907).
function RailHeading({ children }: { children: ReactNode }) {
  return (
    <h5 className="agents-rail__head mb-2 truncate text-eyebrow font-semibold uppercase tracking-[0.6px] text-faint">
      {children}
    </h5>
  )
}

// The Subagents that landed, behind a Collapsible rather than as a count nobody can open. Each one
// is named by what it was asked to do, and the ones the transcript gave no description for are
// numbered in the order they were asked.
function FinishedAgents({ session }: { session: Session }) {
  const { t } = useTranslation()
  const finished = session.delegations.filter((delegation) => delegation.landed)
  if (finished.length === 0) return null

  return (
    <Collapsible className="agents-rail__finished">
      <CollapsibleTrigger className="group mb-1 flex w-full items-center gap-tight p-tight text-left text-chip text-faint hover:text-ink">
        <ChevronRightIcon className="size-[12px] flex-none transition-transform group-data-[panel-open]:rotate-90" />
        {t('rail.finished', { count: finished.length })}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="text-chip">
          {finished.map((delegation, index) => (
            <Chip key={delegation.id}>
              <SessionStateDot status="ended" />
              <span className="truncate text-faint">
                {delegation.label ?? t('rail.subagent', { index: index + 1 })}
              </span>
            </Chip>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

// The shell commands running now (#1907): its own section, because a command the Session is
// running is not a Subagent and a reader looking for one is not looking for the other. A command
// that finished is not here at all, so the number beside the header is what is running.
function ShellSection({ session }: { session: Session }) {
  const { t } = useTranslation()
  if (session.shell.length === 0) return null

  return (
    <section className="agents-rail__shell mt-3">
      <RailHeading>{t('rail.shell', { count: session.shell.length })}</RailHeading>
      <ul className="text-chip">
        {session.shell.map((command) => (
          <Chip key={command.id}>
            <SessionStateDot status="running" />
            <span className="truncate font-mono text-quiet">
              {command.command ?? t('rail.shellBare')}
            </span>
          </Chip>
        ))}
      </ul>
    </section>
  )
}

// The Agents rail (`roster-row-signals-prototype.html` · rail): what the selected Session
// delegated, read the one way the row's dots read it, so the figure on the Roster can be checked
// against the rail's own count line (#1269). A running Subagent is named by what it was asked to
// do, and by its place when it was asked nothing. An open delegation Argo cannot resolve is an
// outline and a count, never a claim that it is running (#1076). The screen draws the rail only
// for a Session that delegated something, so there is no empty rail to word.
export function AgentsRail({ session }: { session: Session }) {
  const { t } = useTranslation()
  const reading = readDelegation(session.status, session.delegations)
  const open = session.delegations.filter((delegation) => !delegation.landed).length
  const running = reading.known ? reading.running : []
  const unresolved = reading.known ? reading.unresolved : open

  return (
    <section className="agents-rail h-full min-h-0 overflow-y-auto p-snug">
      <RailHeading>
        {reading.known ? t('rail.agents', { count: running.length }) : t('rail.agentsUnknown')}
      </RailHeading>
      <ul className="text-chip">
        {running.map((delegation, index) => (
          <Chip key={delegation.id}>
            <SessionStateDot status="running" />
            <span className="truncate text-quiet">
              {delegation.label ?? t('rail.subagent', { index: index + 1 })}
            </span>
          </Chip>
        ))}
        {unresolved === 0 ? null : (
          <Chip>
            <SessionStateDot status="unknown" />
            <span className="truncate text-quiet">
              {t('rail.unresolved', { count: unresolved })}
            </span>
          </Chip>
        )}
      </ul>
      <FinishedAgents session={session} />
      <ShellSection session={session} />
    </section>
  )
}
