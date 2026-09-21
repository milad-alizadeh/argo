import {
  BadgeCheck,
  ChevronDown,
  Code2,
  FileCog,
  Library,
  Package,
  Settings2,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SetupPlan } from '@/domains/projects/contract/setup-plan'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/platform/renderer/components/ui/collapsible'
import { Switch } from '@/platform/renderer/components/ui/switch'

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
        icon={<BadgeCheck />}
        items={plan.capabilities
          .filter(({ disposition }) => disposition !== 'not-applicable')
          .map((capability) => ({
            id: capability.id,
            title: capability.name,
            detail: capability.reason,
            packages: [...capability.effects.dependencies, ...capability.effects.files],
          }))}
        fallbackIcon={<BadgeCheck />}
        onToggle={onToggle}
        selectedIds={selectedIds}
        titleKey="setup.actor.reviewing-plan.skillsAndCapabilities"
      />
      {repositoryTools.length ? (
        <RecommendationGroup
          icon={<Sparkles />}
          items={repositoryTools.map((recommendation) => ({
            id: recommendation.id,
            title: recommendation.recommendedChoice,
            detail: recommendation.reason,
            iconUrl: recommendation.iconUrl,
            packages: recommendation.packageNames,
          }))}
          fallbackIcon={<Sparkles />}
          onToggle={onToggle}
          selectedIds={selectedIds}
          titleKey="setup.actor.reviewing-plan.recommendedTools"
        />
      ) : null}
      <RecommendationGroup
        icon={<FileCog />}
        items={actions.map((action) => ({
          id: action.id,
          title: action.reason,
          detail: action.evidence,
          packages: action.fileCategories,
        }))}
        fallbackIcon={<FileCog />}
        onToggle={onToggle}
        selectedIds={selectedIds}
        titleKey="setup.actor.reviewing-plan.projectChanges"
      />
    </div>
  )
}

export function ProjectSetupPlanSummary({ plan }: { plan: SetupPlan }) {
  const { t } = useTranslation('projects')
  const dependencies = planDependencies(plan)
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
        value={joinOrNone(dependencies, t('setup.actor.reviewing-plan.none'))}
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

function TargetReview({
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

function PackageNames({ names }: { names: string[] }) {
  return names.length ? (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {names.map((name) => (
        <code className="rounded-md bg-muted px-2 py-1 type-code" key={name}>
          {name}
        </code>
      ))}
    </div>
  ) : null
}

function PlanSection({
  children,
  icon,
  subtitle,
  title,
}: {
  children: ReactNode
  icon: ReactNode
  subtitle?: string
  title: string
}) {
  return (
    <Collapsible className="group overflow-hidden rounded-xl border bg-card" defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center gap-[11px] px-3.5 py-3 text-left hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted [&>svg]:size-4">
          {icon}
        </span>
        <span className="min-w-0">
          <strong className="block type-body font-semibold">{title}</strong>
          {subtitle ? (
            <small className="mt-0.5 block type-control text-muted-foreground">{subtitle}</small>
          ) : null}
        </span>
        <ChevronDown className="ml-auto size-[15px] shrink-0 text-muted-foreground transition-transform group-data-[open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function RecommendationGroup({
  fallbackIcon,
  icon,
  items,
  onToggle,
  selectedIds,
  titleKey,
}: {
  fallbackIcon: ReactNode
  icon: ReactNode
  items: Array<{
    id: string
    title: string
    detail: string
    iconUrl?: string
    packages: string[]
  }>
  onToggle: (id: string) => void
  selectedIds: Set<string>
  titleKey:
    | 'setup.actor.reviewing-plan.projectChanges'
    | 'setup.actor.reviewing-plan.recommendedTools'
    | 'setup.actor.reviewing-plan.skillsAndCapabilities'
}) {
  const { t } = useTranslation('projects')
  if (!items.length) return null
  return (
    <PlanSection icon={icon} title={t(titleKey)}>
      <ul>
        {items.map((item) => (
          <li className="border-b px-3.5 py-[11px] last:border-b-0" key={item.id}>
            <span className="flex min-w-0 items-center gap-[11px]">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted [&>svg]:size-4">
                <ToolIcon fallback={fallbackIcon} iconUrl={item.iconUrl} />
              </span>
              <strong className="min-w-0 flex-1 type-body font-semibold">{item.title}</strong>
              <Switch
                aria-label={t('setup.actor.customizing-project-setup.toggleAction', {
                  name: item.title,
                })}
                checked={selectedIds.has(item.id)}
                onCheckedChange={() => onToggle(item.id)}
              />
            </span>
            <span className="ml-[43px] block min-w-0">
              <small className="mt-0.5 block type-control text-muted-foreground">
                {item.detail}
              </small>
              <PackageNames names={item.packages} />
            </span>
          </li>
        ))}
      </ul>
    </PlanSection>
  )
}

function ToolIcon({
  fallback = <Sparkles />,
  iconUrl,
}: {
  fallback?: ReactNode
  iconUrl?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!iconUrl || failed) return <span className="[&>svg]:size-4">{fallback}</span>
  return (
    <img
      alt=""
      aria-hidden="true"
      className="size-4 shrink-0 object-contain"
      onError={() => setFailed(true)}
      src={iconUrl}
    />
  )
}

function SummaryRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
      <span className="mt-0.5 text-muted-foreground [&>svg]:size-4">{icon}</span>
      <span className="min-w-0">
        <strong className="block type-label font-semibold">{label}</strong>
        <small className="mt-0.5 block type-control text-muted-foreground">{value}</small>
      </span>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 rounded-lg border bg-card px-2.5 py-2">
      <small className="block type-caption text-muted-foreground">{label}</small>
      <strong className="mt-1 block type-label font-medium">{value}</strong>
    </span>
  )
}

function planDependencies(plan: SetupPlan) {
  return [
    ...new Set([
      ...plan.targets.flatMap(({ dependencies }) => dependencies),
      ...plan.toolRecommendations.flatMap(({ dependencyChanges, packageNames }) => [
        ...packageNames,
        ...dependencyChanges,
      ]),
      ...plan.capabilities.flatMap(({ effects }) => effects.dependencies),
    ]),
  ]
}

function joinOrNone(values: string[], fallback: string) {
  return values.length ? values.join(' · ') : fallback
}
