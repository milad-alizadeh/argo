import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import type {
  OnboardingProject,
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '../onboarding-presentation'
import { ProjectSetupPlanSummary } from '../plan/project-setup-plan-review'
import {
  ProjectSetupAgentHeader,
  ProjectSetupIntroduction,
  ProjectSetupShell,
} from './project-setup-layout'
import { ProjectSetupScreen } from './project-setup-screen'

type ProjectSetupViewProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  project: OnboardingProject
  snapshot: ProjectSetupSnapshot
}

export function ProjectSetupView({ command, project, snapshot }: ProjectSetupViewProps) {
  const { t } = useTranslation('projects')
  const conversationRef = useRef<HTMLElement>(null)
  const translationValues = {
    count: snapshot.plan?.targets.length ?? 0,
    name: project.name,
  }
  const title = t(`setup.actor.${snapshot.screen}.title`, translationValues)
  const description = t(`setup.actor.${snapshot.screen}.description`, translationValues)
  return (
    <ProjectSetupShell
      accessibleName={t('setup.label', { name: project.name })}
      contentRef={conversationRef}
      event={
        <>
          <span className="grid size-8 place-items-center rounded-full bg-muted">
            <Icon name="folder" size="control" />
          </span>
          <p>{t(setupEvent(snapshot))}</p>
        </>
      }
      header={<ProjectSetupAgentHeader />}
      introduction={<ProjectSetupIntroduction />}
      sidebar={<ProjectSetupEvidence snapshot={snapshot} />}
      sidebarDisclosureLabel={t('setup.shell.reviewDisclosure')}
    >
      {snapshot.screen === 'reviewing-diff' ? null : (
        <header>
          {snapshot.screen === 'customizing-project-setup' ? (
            <Button
              aria-label={t('setup.actor.customizing-project-setup.backAction')}
              className="-ml-2 mb-3 size-9"
              onClick={() => void command({ type: 'back' })}
              size="icon-sm"
              variant="ghost"
            >
              <Icon name="back" />
            </Button>
          ) : null}
          <h1
            className="onboarding-stage-heading type-title font-heading text-foreground"
            tabIndex={-1}
          >
            {title}
          </h1>
          <p className="mt-2 max-w-2xl type-body text-muted-foreground">{description}</p>
        </header>
      )}
      <ProjectSetupScreen command={command} snapshot={snapshot} />
    </ProjectSetupShell>
  )
}

function ProjectSetupEvidence({ snapshot }: Pick<ProjectSetupViewProps, 'snapshot'>) {
  const { t } = useTranslation('projects')
  const plan =
    snapshot.screen === 'reviewing-plan' || snapshot.screen === 'customizing-project-setup'
      ? snapshot.plan
      : null
  return (
    <>
      <h2 className="type-heading">{t('setup.shell.reviewTitle')}</h2>
      {plan ? (
        <div className="mt-5">
          <ProjectSetupPlanSummary plan={plan} />
        </div>
      ) : null}
      <ol className={plan ? 'mt-7 grid border-t pt-5' : 'mt-5 grid'}>
        {snapshot.progress.length === 0 ? (
          <li className="relative grid min-h-11 grid-cols-[var(--size-icon-control)_minmax(0,1fr)] gap-2.5 type-control text-muted-foreground">
            <span className="z-10 grid size-(--size-icon-control) place-items-center rounded-full border bg-sidebar">
              <Icon name="setup-step-pending" className="size-3" />
            </span>
            <p>{t('setup.actor.busy')}</p>
          </li>
        ) : (
          snapshot.progress.map((step) => (
            <li
              className="group relative grid min-h-11 grid-cols-[var(--size-icon-control)_minmax(0,1fr)] gap-2.5 type-control text-muted-foreground before:absolute before:left-3 before:h-11 before:w-px before:bg-border last:before:hidden data-[complete=true]:text-foreground"
              data-complete={step.status === 'passed'}
              key={step.stepId}
            >
              <span className="z-10 grid size-(--size-icon-control) place-items-center rounded-full border bg-sidebar group-data-[complete=true]:border-success/40 group-data-[complete=true]:bg-success/10 group-data-[complete=true]:text-success">
                {step.status === 'passed' ? (
                  <Icon name="confirmed" className="size-3" />
                ) : (
                  <Icon name="setup-step-pending" className="size-3" />
                )}
              </span>
              <p className="pt-0.5">{step.message}</p>
            </li>
          ))
        )}
      </ol>
    </>
  )
}

function setupEvent(snapshot: ProjectSetupSnapshot) {
  switch (snapshot.screen) {
    case 'applying':
      return 'setup.event.applyStarted'
    case 'awaiting-approval':
      return 'setup.event.permissionPending'
    case 'interrupted':
      return 'setup.event.interrupted'
    case 'restarting':
      return 'setup.event.restarting'
    case 'restart-failed':
      return 'setup.event.restartFailed'
    case 'reviewing-diff':
      return 'setup.event.reviewingChanges'
    case 'reviewing-plan':
    case 'customizing-project-setup':
      return 'setup.event.planReady'
    default:
      return 'setup.event.planningStarted'
  }
}
