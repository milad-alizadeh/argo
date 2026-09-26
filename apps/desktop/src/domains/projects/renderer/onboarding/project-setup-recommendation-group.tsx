import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/platform/renderer/components/ui/switch'
import { PackageNames, PlanSection, ToolIcon } from './plan/project-setup-plan-review-parts'

export function RecommendationGroup({
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
          <li className="border-b px-3.5 py-3 last:border-b-0" key={item.id}>
            <span className="flex min-w-0 items-center gap-3">
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
            <span className="ml-11 block min-w-0">
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
