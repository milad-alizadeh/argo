import {
  BadgeCheck,
  FileCog,
  Library,
  Package,
  Settings2,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SetupPlan } from '@/domains/projects/contract/setup-plan'
import {
  joinOrNone,
  PlanSection,
  planDependencies,
  SummaryRow,
} from './project-setup-plan-review-parts'
import { RecommendationGroup } from './project-setup-recommendation-group'
import { TargetReview } from './project-setup-target-review'

export function ProjectSetupPlanReview({ plan }: { plan: SetupPlan }) {
  const { t } = useTranslation('projects')
  return (
    <section aria-label={t('setup.actor.reviewing-plan.targets')} className="grid gap-4">
      {plan.targets.map((target) => (
        <TargetReview
          key={target.id}
          recommendations={plan.toolRecommendations.filter(({ targetIds }) =>
            targetIds.includes(target.id),
          )}
          target={target}
        />
      ))}
    </section>
  )
}

export function ProjectSetupPlanConfiguration({
  onToggle,
  plan,
  selectedIds,
}: {
  onToggle: (id: string) => void
  plan: SetupPlan
  selectedIds: Set<string>
}) {
  const repositoryTools = plan.toolRecommendations.filter(({ scope }) => scope === 'repository')
  const actions = [...plan.repositoryActions, ...plan.targetActions]
  return (
    <div className="grid gap-4">
      <RecommendationGroup
        fallbackIcon={<BadgeCheck />}
        icon={<BadgeCheck />}
        items={plan.capabilities
          .filter(({ disposition }) => disposition !== 'not-applicable')
          .map((capability) => ({
            id: capability.id,
            title: capability.name,
            detail: capability.reason,
            packages: [...capability.effects.dependencies, ...capability.effects.files],
          }))}
        onToggle={onToggle}
        selectedIds={selectedIds}
        titleKey="setup.actor.reviewing-plan.skillsAndCapabilities"
      />
      {repositoryTools.length ? (
        <RecommendationGroup
          fallbackIcon={<Sparkles />}
          icon={<Sparkles />}
          items={repositoryTools.map((recommendation) => ({
            id: recommendation.id,
            title: recommendation.recommendedChoice,
            detail: recommendation.reason,
            iconUrl: recommendation.iconUrl,
            packages: recommendation.packageNames,
          }))}
          onToggle={onToggle}
          selectedIds={selectedIds}
          titleKey="setup.actor.reviewing-plan.recommendedTools"
        />
      ) : null}
      <RecommendationGroup
        fallbackIcon={<FileCog />}
        icon={<FileCog />}
        items={actions.map((action) => ({
          id: action.id,
          title: action.reason,
          detail: action.evidence,
          packages: action.fileCategories,
        }))}
        onToggle={onToggle}
        selectedIds={selectedIds}
        titleKey="setup.actor.reviewing-plan.projectChanges"
      />
    </div>
  )
}

export function ProjectSetupPlanSummary({ plan }: { plan: SetupPlan }) {
  const { t } = useTranslation('projects')
  return (
    <PlanSection icon={<Settings2 />} title={t('setup.actor.reviewing-plan.summaryTitle')}>
      <SummaryRow
        icon={<Package />}
        label={t('setup.actor.reviewing-plan.targets')}
        value={plan.targets.map(({ name }) => name).join(' · ')}
      />
      <SummaryRow
        icon={<Sparkles />}
        label={t('setup.actor.reviewing-plan.recommendedTools')}
        value={joinOrNone(
          plan.toolRecommendations.map(({ recommendedChoice }) => recommendedChoice),
          t('setup.actor.reviewing-plan.none'),
        )}
      />
      <SummaryRow
        icon={<Library />}
        label={t('setup.actor.reviewing-plan.dependencies')}
        value={joinOrNone(planDependencies(plan), t('setup.actor.reviewing-plan.none'))}
      />
      <SummaryRow
        icon={<FileCog />}
        label={t('setup.actor.reviewing-plan.projectChanges')}
        value={t('setup.actor.reviewing-plan.changeCount', {
          count: plan.repositoryActions.length + plan.targetActions.length,
        })}
      />
      <SummaryRow
        icon={<TerminalSquare />}
        label={t('setup.actor.reviewing-plan.verification')}
        value={joinOrNone(
          plan.verification.flatMap(({ command }) => (command ? [command] : [])),
          t('setup.actor.reviewing-plan.none'),
        )}
      />
    </PlanSection>
  )
}
