import { Code2, Package, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SetupPlan } from '@/domains/projects/contract/setup-plan'
import {
  Fact,
  joinOrNone,
  PackageNames,
  PlanSection,
  ToolIcon,
} from './project-setup-plan-review-parts'

export function TargetReview({
  recommendations,
  target,
}: {
  recommendations: SetupPlan['toolRecommendations']
  target: SetupPlan['targets'][number]
}) {
  const { t } = useTranslation('projects')
  return (
    <PlanSection icon={<Package />} subtitle={target.path} title={target.name}>
      <div className="grid gap-3 border-b bg-muted/20 px-3.5 py-3">
        <h3 className="flex items-center gap-2 type-heading">
          <Code2 className="size-4 text-muted-foreground" />
          {t('setup.actor.reviewing-plan.currentSetup')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Fact
            label={t('setup.actor.reviewing-plan.framework')}
            value={target.framework ?? t('setup.actor.reviewing-plan.notSet')}
          />
          <Fact
            label={t('setup.actor.reviewing-plan.packageManager')}
            value={target.packageManager ?? t('setup.actor.reviewing-plan.notSet')}
          />
        </div>
        <CommandList commands={target.commands} />
        <Fact
          label={t('setup.actor.reviewing-plan.dependencies')}
          value={joinOrNone(target.dependencies, t('setup.actor.reviewing-plan.none'))}
        />
        <p className="type-label text-muted-foreground">{target.evidence}</p>
      </div>
      <div className="px-3.5 py-3">
        <h3 className="flex items-center gap-2 type-heading">
          <Sparkles className="size-4 text-muted-foreground" />
          {t('setup.actor.reviewing-plan.agentWillAdd')}
        </h3>
        {recommendations.length ? (
          <RecommendationRows recommendations={recommendations} />
        ) : (
          <p className="mt-2 type-control text-muted-foreground">
            {t('setup.actor.reviewing-plan.noSuggestions')}
          </p>
        )}
      </div>
    </PlanSection>
  )
}

function CommandList({ commands }: { commands: SetupPlan['targets'][number]['commands'] }) {
  const { t } = useTranslation('projects')
  return (
    <div>
      <h4 className="flex items-center gap-2 type-label font-semibold">
        <Code2 className="size-4 text-muted-foreground" />
        {t('setup.actor.reviewing-plan.commands')}
      </h4>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {Object.entries(commands).map(([name, value]) => (
          <div className="min-w-0 rounded-lg border bg-card px-2.5 py-2" key={name}>
            <dt className="type-caption text-muted-foreground">{name}</dt>
            <dd>
              <code className="mt-1 block truncate type-code">{value}</code>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function RecommendationRows({
  recommendations,
}: {
  recommendations: SetupPlan['toolRecommendations']
}) {
  return (
    <ul>
      {recommendations.map((recommendation) => (
        <li className="border-t py-2.5 first:border-t-0" key={recommendation.id}>
          <span className="flex min-w-0 items-center gap-2">
            <ToolIcon iconUrl={recommendation.iconUrl} />
            <strong className="type-body font-semibold">{recommendation.recommendedChoice}</strong>
          </span>
          <span className="ml-6 block min-w-0">
            <p className="type-control text-muted-foreground">{recommendation.reason}</p>
            <PackageNames names={recommendation.packageNames} />
          </span>
        </li>
      ))}
    </ul>
  )
}
