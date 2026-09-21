import { useTranslation } from 'react-i18next'
import type {
  ProjectSetupCommand,
  ProjectSetupSnapshot,
} from '@/domains/projects/contract/contract'
import { RunningText } from '@/platform/renderer/components/running-text'
import { Button } from '@/platform/renderer/components/ui/button'
import { Approval, CancelFailed } from './project-setup-approval-screen'
import { InputScreen } from './project-setup-input-screen'
import { ProjectSetupMethodScreen } from './project-setup-method-screen'
import { Progress } from './project-setup-progress'
import { Recovery } from './project-setup-recovery'
import { ReviewScreen } from './project-setup-review-screen'

type ProjectSetupScreenProps = {
  command: (command: ProjectSetupCommand) => Promise<void>
  snapshot: ProjectSetupSnapshot
}

export function ProjectSetupScreen({ command, snapshot }: ProjectSetupScreenProps) {
  switch (snapshot.screen) {
    case 'choosing-method':
      return <ProjectSetupMethodScreen command={command} snapshot={snapshot} />
    case 'planning':
    case 'applying':
      return <Progress command={command} snapshot={snapshot} />
    case 'cancelling':
    case 'finalizing':
      return <Busy />
    case 'cancel-failed':
      return <CancelFailed command={command} snapshot={snapshot} />
    case 'awaiting-approval':
      return <Approval command={command} snapshot={snapshot} />
    case 'questions':
    case 'manual':
      return <InputScreen command={command} snapshot={snapshot} />
    case 'reviewing-plan':
    case 'customizing-project-setup':
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

function Busy() {
  const { t } = useTranslation('projects')
  return (
    <p className="mt-6 type-body text-muted-foreground" aria-busy="true">
      <RunningText running>{t('setup.actor.busy')}</RunningText>
    </p>
  )
}

function Deferred({ command }: Pick<ProjectSetupScreenProps, 'command'>) {
  const { t } = useTranslation('projects')
  return (
    <div className="mt-6 flex justify-end">
      <Button onClick={() => void command({ type: 'resume-setup' })}>
        {t('setup.actor.deferred.action')}
      </Button>
    </div>
  )
}

function Ready({ command }: Pick<ProjectSetupScreenProps, 'command'>) {
  const { t } = useTranslation('projects')
  return (
    <div className="mt-6 flex justify-end">
      <Button onClick={() => void command({ type: 'edit-setup' })}>
        {t('setup.actor.ready.action')}
      </Button>
    </div>
  )
}
