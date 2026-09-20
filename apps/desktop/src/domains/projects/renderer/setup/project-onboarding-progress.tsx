import { Check, CheckCircle2, Circle, Code2, GitBranch, Package, Settings2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { OnboardingController, OnboardingStage } from './project-onboarding'
import { onboardingText, runnableTargetCount } from './project-onboarding-copy'

const progressStages: Array<{ ids: OnboardingStage[]; label: string }> = [
  {
    ids: ['method', 'no-default', 'harness', 'manual'],
    label: onboardingText('progress.method'),
  },
  { ids: ['analyzing'], label: onboardingText('progress.analyze') },
  { ids: ['recommendations', 'customize'], label: onboardingText('progress.targets') },
  { ids: ['project-setup'], label: onboardingText('progress.project') },
  { ids: ['applying', 'apply-failed', 'starting'], label: onboardingText('progress.apply') },
]

export function SetupProgress({ stage }: { stage: OnboardingStage }) {
  const current = progressStages.findIndex(({ ids }) => ids.includes(stage))
  return (
    <ol className="space-y-1">
      {progressStages.map((item, index) => (
        <ProgressItem
          active={index === current && stage !== 'complete'}
          complete={index < current || stage === 'complete'}
          item={item}
          key={item.label}
        />
      ))}
    </ol>
  )
}

function ProgressItem({
  active,
  complete,
  item,
}: {
  active: boolean
  complete: boolean
  item: { label: string }
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2 type-body ${active ? 'bg-selected text-foreground' : 'text-muted-foreground'}`}
    >
      {complete ? (
        <CheckCircle2 className="size-4 text-diff-added" />
      ) : (
        <Circle className={`size-4 ${active ? 'fill-foreground/10' : ''}`} />
      )}
      {item.label}
    </li>
  )
}

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
        value={onboardingText(`event.${state.event}`)}
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
  const { state } = controller
  const applying = ['applying', 'apply-failed', 'starting', 'complete'].includes(state.stage)
  const items = [
    { complete: state.stage !== 'folder', label: onboardingText('timeline.folder') },
    { complete: Boolean(state.method), label: onboardingText('timeline.method') },
    {
      complete: !['folder', 'method', 'no-default', 'harness', 'analyzing'].includes(state.stage),
      label: onboardingText('timeline.plan'),
    },
    { complete: applying, label: onboardingText('timeline.approved') },
    {
      complete: state.stage === 'complete',
      label:
        state.method === 'manual' || state.skippedSetup
          ? onboardingText('timeline.opened')
          : onboardingText('timeline.started'),
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
