import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { defaultProjectSetupHarnesses } from '@/domains/projects/contract/project-setup-harness'
import { Button } from '@/platform/renderer/components/ui/button'
import { CancelFailed, EffectApproval } from './project-setup-approval-screen'
import { InputScreen } from './project-setup-input-screen'
import { Recovery } from './project-setup-recovery'
import { ReviewScreen } from './project-setup-review-screen'

type ProjectSetupScreenProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}

export function ProjectSetupScreen({ command, snapshot }: ProjectSetupScreenProps) {
  switch (snapshot.screen) {
    case 'choosing-method':
      return <ChoosingMethod command={command} snapshot={snapshot} />
    case 'planning-unavailable':
      return <PlanningUnavailable command={command} />
    case 'preflight':
      return <Preflight />
    case 'planning':
    case 'applying':
      return <Progress command={command} snapshot={snapshot} />
    case 'cancelling':
    case 'finalizing':
      return <Busy />
    case 'cancel-failed':
      return <CancelFailed command={command} snapshot={snapshot} />
    case 'awaiting-approval':
      return <EffectApproval command={command} snapshot={snapshot} />
    case 'questions':
    case 'invalid-plan':
    case 'manual':
      return <InputScreen command={command} snapshot={snapshot} />
    case 'reviewing-plan':
    case 'reviewing-diff':
      return <ReviewScreen command={command} snapshot={snapshot} />
    case 'review-required':
      return <Recovery command={command} snapshot={snapshot} review />
    case 'interrupted':
      return <Recovery command={command} snapshot={snapshot} review={false} />
    case 'deferred':
      return <Deferred command={command} />
    case 'ready':
      return <Ready command={command} />
  }
}

function Preflight() {
  const { t } = useTranslation('projects')
  return (
    <p className="mt-6 type-body" aria-busy="true">
      {t('setup.actor.preflight.description')}
    </p>
  )
}

function ChoosingMethod({
  command,
  snapshot,
}: Pick<ProjectSetupScreenProps, 'command' | 'snapshot'>) {
  const { t } = useTranslation('projects')
  return (
    <div className="mt-6 flex gap-3">
      {(snapshot.harnesses ?? defaultProjectSetupHarnesses).map(
        ({ harness, unavailableReason }) => (
          <div className="grid gap-1" key={harness}>
            <Button
              disabled={unavailableReason !== null}
              onClick={() => void command({ type: 'choose-agent', harness })}
            >
              {harness === 'claude'
                ? t('setup.actor.choosing-method.agentAction')
                : t('setup.actor.choosing-method.codexAction')}
            </Button>
            {unavailableReason ? (
              <p className="type-caption text-muted-foreground">
                {harness === 'claude'
                  ? t('setup.harnessUnavailable.claude')
                  : t('setup.harnessUnavailable.codex')}
              </p>
            ) : null}
          </div>
        ),
      )}
      <MethodButtons command={command} />
    </div>
  )
}

function PlanningUnavailable({ command }: Pick<ProjectSetupScreenProps, 'command'>) {
  const { t } = useTranslation('projects')
  return (
    <div className="mt-6 flex gap-3">
      <Button onClick={() => void command({ type: 'retry-preflight' })}>
        {t('setup.actor.planning-unavailable.retry')}
      </Button>
      <MethodButtons command={command} outlined />
    </div>
  )
}

function MethodButtons({
  command,
  outlined = false,
}: Pick<ProjectSetupScreenProps, 'command'> & { outlined?: boolean }) {
  const { t } = useTranslation('projects')
  return (
    <>
      <Button
        onClick={() => void command({ type: 'choose-manual' })}
        variant={outlined ? 'outline' : 'default'}
      >
        {t('setup.actor.manual.action')}
      </Button>
      <Button onClick={() => void command({ type: 'defer' })} variant="outline">
        {t('setup.actor.deferred.action')}
      </Button>
    </>
  )
}

function Progress({ command, snapshot }: Pick<ProjectSetupScreenProps, 'command' | 'snapshot'>) {
  const { t } = useTranslation('projects')
  return (
    <ol className="mt-6 grid gap-2" aria-label={t('setup.actor.progressLabel')}>
      {snapshot.progress.map((progress) => (
        <li className="rounded-md border p-3 type-body" key={progress.stepId}>
          <span className="font-medium">{progress.stepId}</span>: {progress.message}
        </li>
      ))}
      <Button
        className="w-fit"
        onClick={() => void command({ type: 'cancel-setup' })}
        variant="outline"
      >
        {t('setup.actor.cancelAction')}
      </Button>
    </ol>
  )
}

function Busy() {
  const { t } = useTranslation('projects')
  return (
    <p className="mt-6 type-body" aria-busy="true">
      {t('setup.actor.busy')}
    </p>
  )
}

function Deferred({ command }: Pick<ProjectSetupScreenProps, 'command'>) {
  const { t } = useTranslation('projects')
  return (
    <Button className="mt-6 w-fit" onClick={() => void command({ type: 'resume-setup' })}>
      {t('setup.actor.deferred.action')}
    </Button>
  )
}

function Ready({ command }: Pick<ProjectSetupScreenProps, 'command'>) {
  const { t } = useTranslation('projects')
  return (
    <Button
      className="mt-6 w-fit"
      onClick={() => void command({ type: 'start-repair-or-upgrade' })}
    >
      {t('setup.actor.ready.action')}
    </Button>
  )
}
