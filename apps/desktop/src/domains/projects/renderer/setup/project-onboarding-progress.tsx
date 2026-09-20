import { Check, Circle, Code2, GitBranch, Package, Settings2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { OnboardingController } from './project-onboarding'
import { onboardingText, runnableTargetCount } from './project-onboarding-copy'

export function SetupEvidence({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { state } = controller
  return (
    <div className="space-y-3">
      <h2 className="type-heading">{t('onboarding.evidence.title')}</h2>
      <EvidenceRow
        icon={<GitBranch />}
        label={t('onboarding.evidence.project')}
        value={t('onboarding.evidence.projectFolder')}
      />
      <EvidenceRow
        icon={<Package />}
        label={t('onboarding.evidence.targets')}
        value={runnableTargetCount(state.targets.length)}
      />
      <EvidenceRow
        icon={<Code2 />}
        label={t('onboarding.evidence.stack')}
        value={t('onboarding.evidence.stackValue')}
      />
      <EvidenceRow
        icon={<Settings2 />}
        label={t('onboarding.evidence.lastAction')}
        value={onboardingText(`onboarding.event.${state.event}`)}
      />
    </div>
  )
}

function EvidenceRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-2.5">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className="min-w-0">
        <strong className="block type-label font-medium">{label}</strong>
        <span className="block truncate type-meta text-muted-foreground">{value}</span>
      </span>
    </div>
  )
}

export function AgentTimeline({ controller }: { controller: OnboardingController }) {
  const { t } = useTranslation('projects')
  const { state } = controller
  const applying = ['applying', 'apply-failed', 'starting', 'complete'].includes(state.stage)
  const items = [
    { complete: state.stage !== 'folder', label: t('onboarding.timeline.folder') },
    { complete: Boolean(state.method), label: t('onboarding.timeline.method') },
    {
      complete: !['folder', 'method', 'no-default', 'harness', 'analyzing'].includes(state.stage),
      label: t('onboarding.timeline.plan'),
    },
    { complete: applying, label: t('onboarding.timeline.approved') },
    {
      complete: state.stage === 'complete',
      label:
        state.method === 'manual' || state.skippedSetup
          ? t('onboarding.timeline.opened')
          : t('onboarding.timeline.started'),
    },
  ]
  return (
    <ol className="onboarding-agent-timeline">
      {items.map((item) => (
        <li data-complete={item.complete} key={item.label}>
          <span>
            {item.complete ? <Check className="size-3" /> : <Circle className="size-3" />}
          </span>
          <p>{item.label}</p>
        </li>
      ))}
    </ol>
  )
}
