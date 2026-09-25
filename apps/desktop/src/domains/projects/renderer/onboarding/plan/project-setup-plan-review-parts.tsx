import { type ReactNode, useState } from 'react'
import type { SetupPlan } from '@/domains/projects/renderer/onboarding/model/setup-plan'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/platform/renderer/components/ui/collapsible'

export function PackageNames({ names }: { names: string[] }) {
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

export function PlanSection({
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
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-muted/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted [&>svg]:size-4">
          {icon}
        </span>
        <span className="min-w-0">
          <strong className="block type-body font-semibold">{title}</strong>
          {subtitle ? (
            <small className="mt-0.5 block type-control text-muted-foreground">{subtitle}</small>
          ) : null}
        </span>
        <Icon
          name="chevron-down"
          className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-data-[open]:rotate-180"
          size="control"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function ToolIcon({
  fallback = <Icon name="sparkles" />,
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

export function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
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

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 rounded-lg border bg-card px-2.5 py-2">
      <small className="block type-caption text-muted-foreground">{label}</small>
      <strong className="mt-1 block type-label font-medium">{value}</strong>
    </span>
  )
}

export function planDependencies(plan: SetupPlan) {
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

export function joinOrNone(values: string[], fallback: string) {
  return values.length ? values.join(' · ') : fallback
}
