// THROWAWAY PROTOTYPE (#2464): representative controls and content for Project onboarding.
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Code2,
  FileJson,
  Folder,
  FolderOpen,
  GitBranch,
  LoaderCircle,
  MessagesSquare,
  Package,
  Play,
  Plus,
  Settings2,
  Sparkles,
  TerminalSquare,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { EmptyProjectWindow } from '@/domains/projects/renderer/components/empty-project-window'
import { CockpitShell } from '@/platform/renderer/cockpit/components/cockpit-shell'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/platform/renderer/components/ui/dropdown-menu'
import { Input } from '@/platform/renderer/components/ui/input'
import { Progress, ProgressLabel } from '@/platform/renderer/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/platform/renderer/components/ui/select'
import { Switch } from '@/platform/renderer/components/ui/switch'
import { Textarea } from '@/platform/renderer/components/ui/textarea'
import {
  ANALYSIS_TASKS,
  applyTasksFor,
  type PrototypeApplyTask,
  type PrototypeController,
  type PrototypeRecommendation,
  type PrototypeStage,
  type PrototypeTarget,
  targetsFromManualSource,
} from './project-onboarding-prototype'

export type PrototypePresentation = 'runway' | 'inspector' | 'briefing'

const HARNESS_CHOICES = [
  { label: 'Codex', value: 'codex' },
  { label: 'Claude Code', value: 'claude' },
] as const

const PROGRESS_STAGES: Array<{ ids: PrototypeStage[]; label: string }> = [
  { ids: ['method', 'no-default', 'harness', 'manual'], label: '1 · Setup method' },
  { ids: ['analyzing'], label: '2 · Analyze' },
  { ids: ['recommendations', 'customize'], label: '3 · Targets' },
  { ids: ['project-setup'], label: '4 · Project setup' },
  { ids: ['review'], label: '5 · Review' },
  { ids: ['applying', 'apply-failed', 'starting'], label: '6 · Apply' },
]

function stageProgress(stage: PrototypeStage) {
  return PROGRESS_STAGES.findIndex(({ ids }) => ids.includes(stage))
}

export function ProjectEntryScene({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  if (state.entryPoint === 'empty') {
    return <EmptyProjectWindow busy={false} onAdd={actions.openFolder} />
  }
  return (
    <CockpitShell
      header={<PrototypeProjectSelector onAdd={actions.openFolder} />}
      sidebar={<RepresentativeSessionSidebar />}
    >
      <RepresentativeSession />
    </CockpitShell>
  )
}

function PrototypeProjectSelector({ onAdd }: { onAdd: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label="Current Project: Argo" size="sm" variant="ghost" />}
      >
        <Folder />
        <span className="max-w-36 truncate font-medium">Argo</span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch Project</DropdownMenuLabel>
          <DropdownMenuItem>
            <Folder />
            <span className="flex-1">Argo</span>
            <Check />
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Folder />
            <span className="flex-1">Waypoint</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAdd}>
          <Plus />
          Add Project…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function RepresentativeSessionSidebar() {
  return (
    <div className="flex h-full flex-col px-3 py-3">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="type-heading">Sessions</span>
        <Button aria-label="New Session" size="icon-xs" variant="ghost">
          <Plus />
        </Button>
      </div>
      <div className="mt-3 space-y-1">
        <RepresentativeSessionRow active label="Project onboarding exploration" />
        <RepresentativeSessionRow label="Desktop release checklist" />
        <RepresentativeSessionRow label="Ticket feed performance" />
      </div>
    </div>
  )
}

function RepresentativeSessionRow({ active = false, label }: { active?: boolean; label: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${active ? 'bg-selected' : 'text-muted-foreground'}`}>
      <div className="flex items-center gap-2 type-body">
        <span className={`size-1.5 rounded-full ${active ? 'bg-active' : 'bg-idle'}`} />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate pl-3.5 type-meta text-muted-foreground">argo/#2464</p>
    </div>
  )
}

function RepresentativeSession() {
  return (
    <div className="flex h-full flex-col">
      <div className="drag-region h-(--size-chrome-bar) shrink-0 border-b border-border/60" />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end px-8 pb-24">
        <div className="rounded-xl border bg-card px-5 py-4 shadow-surface">
          <div className="flex items-center gap-2 type-heading">
            <MessagesSquare className="size-4" />
            Project onboarding exploration
          </div>
          <p className="mt-2 type-body text-muted-foreground">
            Add another Project from the selector to start the onboarding prototype.
          </p>
        </div>
      </div>
    </div>
  )
}

export function SetupProgress({ stage }: { stage: PrototypeStage }) {
  const current = stageProgress(stage)
  return (
    <ol className="space-y-1">
      {PROGRESS_STAGES.map((item, index) => {
        const complete = index < current || stage === 'complete'
        const active = index === current && stage !== 'complete'
        return (
          <li
            className={`flex items-center gap-3 rounded-lg px-3 py-2 type-body ${active ? 'bg-selected text-foreground' : 'text-muted-foreground'}`}
            key={item.label}
          >
            {complete ? (
              <CheckCircle2 className="size-4 text-diff-added" />
            ) : (
              <Circle className={`size-4 ${active ? 'fill-foreground/10' : ''}`} />
            )}
            {item.label}
          </li>
        )
      })}
    </ol>
  )
}

export function SetupStageContent({
  controller,
  presentation,
}: {
  controller: PrototypeController
  presentation: PrototypePresentation
}) {
  const content = stageContent(controller)
  return (
    <div
      className="prototype-stage"
      data-presentation={presentation}
      data-stage={controller.state.stage}
    >
      {content}
      {shouldOfferSkip(controller) ? (
        <div className="prototype-persistent-skip">
          <Button onClick={controller.actions.skipSetup} variant="ghost">
            Skip for now
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function shouldOfferSkip(controller: PrototypeController) {
  if (controller.state.method === 'manual') {
    return ['manual', 'review'].includes(controller.state.stage)
  }
  return ['analyzing', 'recommendations', 'customize', 'project-setup', 'review'].includes(
    controller.state.stage,
  )
}

function stageContent(controller: PrototypeController) {
  switch (controller.state.stage) {
    case 'folder':
      return <FolderStage controller={controller} />
    case 'method':
      return <MethodStage controller={controller} />
    case 'no-default':
      return <NoDefaultHarnessStage controller={controller} />
    case 'harness':
      return <HarnessStage controller={controller} />
    case 'analyzing':
      return <AnalyzingStage controller={controller} />
    case 'recommendations':
      return <RecommendationsStage controller={controller} />
    case 'customize':
      return <CustomizeStage controller={controller} />
    case 'project-setup':
      return <ProjectSetupStage controller={controller} />
    case 'manual':
      return <ManualStage controller={controller} />
    case 'review':
      return <ReviewStage controller={controller} />
    case 'applying':
      return <ApplyStage controller={controller} />
    case 'apply-failed':
      return <ApplyFailedStage controller={controller} />
    case 'starting':
      return <StartingStage controller={controller} />
    case 'complete':
      return <CompleteStage controller={controller} />
    case 'entry':
      return null
  }
}

function StageHeading({ children, description }: { children: ReactNode; description: string }) {
  return (
    <header>
      <h1 className="prototype-stage-heading type-title font-heading text-foreground" tabIndex={-1}>
        {children}
      </h1>
      <p className="mt-2 max-w-2xl type-body text-muted-foreground">{description}</p>
    </header>
  )
}

function targetCount(count: number) {
  return `${count} Target${count === 1 ? '' : 's'}`
}

function runnableTargetCount(count: number) {
  return `${count} runnable Target${count === 1 ? '' : 's'}`
}

function SectionCard({
  action,
  children,
  className = '',
  icon,
  subtitle,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  className?: string
  icon: ReactNode
  subtitle?: string
  title: string
}) {
  const bodyId = useId()
  const [expanded, setExpanded] = useState(true)
  return (
    <section className={`prototype-section-card ${className}`}>
      <div className="prototype-section-card__header-row">
        <SectionCardHeader
          controls={bodyId}
          expanded={expanded}
          icon={icon}
          onToggle={() => setExpanded((current) => !current)}
          subtitle={subtitle}
          title={title}
        />
        {action ? <span className="prototype-section-card__action">{action}</span> : null}
      </div>
      <div hidden={!expanded} id={bodyId}>
        {children}
      </div>
    </section>
  )
}

function SectionCardHeader({
  controls,
  expanded,
  icon,
  onToggle,
  subtitle,
  title,
}: {
  controls?: string
  expanded?: boolean
  icon: ReactNode
  onToggle?: () => void
  subtitle?: string
  title: string
}) {
  const content = (
    <>
      <span className="prototype-section-card__icon">{icon}</span>
      <span className="min-w-0">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      {onToggle ? (
        <ChevronDown
          aria-hidden="true"
          className="prototype-section-card__chevron"
          data-expanded={expanded}
        />
      ) : null}
    </>
  )
  if (onToggle) {
    return (
      <button
        aria-controls={controls}
        aria-expanded={expanded}
        className="prototype-section-card__header prototype-section-card__toggle"
        onClick={onToggle}
        type="button"
      >
        {content}
      </button>
    )
  }
  return <div className="prototype-section-card__header">{content}</div>
}

function SubsectionHeader({ icon, title }: { icon?: ReactNode; title: string }) {
  return (
    <h3 className="prototype-subsection-header">
      {icon ? <span>{icon}</span> : null}
      {title}
    </h3>
  )
}

function OptionRow({
  action,
  detail,
  icon,
  title,
}: {
  action?: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  title: ReactNode
}) {
  return (
    <div className="prototype-option-row">
      {icon ? <span className="prototype-option-row__icon">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {action ? <span className="prototype-option-row__action">{action}</span> : null}
    </div>
  )
}

function BackAction({ controller }: { controller: PrototypeController }) {
  return (
    <Button
      aria-label="Back"
      className="-ml-2 mb-3 size-9"
      onClick={controller.actions.back}
      size="icon-sm"
      variant="ghost"
    >
      <ArrowLeft />
    </Button>
  )
}

function FolderStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading description="Choose the Project folder. Argo will find Targets inside it.">
        Choose a Project folder
      </StageHeading>
      <button className="prototype-folder-choice mt-8" onClick={actions.chooseFolder} type="button">
        <span className="grid size-11 place-items-center rounded-lg bg-muted">
          <FolderOpen className="size-5" />
        </span>
        <span className="min-w-0 text-left">
          <strong className="block type-body font-medium">argo</strong>
          <span className="block truncate type-label text-muted-foreground">
            {state.projectPath}
          </span>
        </span>
        <span className="ml-auto type-label text-muted-foreground">Choose</span>
      </button>
    </>
  )
}

function MethodStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  const defaultHarnessLabel = state.defaultHarness === 'claude' ? 'Claude Code' : 'Codex'
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading description="Ask an agent to find Targets and recommend setup, or define Target commands without changing Project files.">
        1 · Choose a setup method
      </StageHeading>
      <div className="prototype-method-grid mt-8">
        <SectionCard
          className="prototype-agent-method-card"
          icon={<Sparkles />}
          subtitle="A harness is the app that Argo uses to run an agent."
          title="Set up with an agent"
        >
          <div className="prototype-agent-method-card__controls">
            <HarnessSelect label="Harness" onChange={actions.setHarness} value={state.harness} />
            <div className="mt-3 flex items-center gap-2">
              {state.defaultHarness ? (
                <>
                  <CheckCircle2 className="size-4 text-diff-added" />
                  <p className="type-label text-muted-foreground">
                    {defaultHarnessLabel} is the default harness. It is ready.
                  </p>
                </>
              ) : (
                <>
                  <Circle className="size-4 text-muted-foreground" />
                  <p className="type-label text-muted-foreground">
                    Choose a default harness before Argo analyzes the Project.
                  </p>
                </>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {!state.defaultHarness ? (
                <Button
                  onClick={() => actions.configureDefaultHarness(state.harness)}
                  variant="outline"
                >
                  Use {state.harness === 'codex' ? 'Codex' : 'Claude Code'} as default
                </Button>
              ) : null}
              <Button
                disabled={!state.defaultHarness}
                onClick={() => actions.chooseMethod('agent')}
              >
                Analyze Project
              </Button>
            </div>
          </div>
        </SectionCard>
        <button
          className="prototype-method-choice prototype-section-card"
          onClick={() => actions.chooseMethod('manual')}
          type="button"
        >
          <SectionCardHeader
            icon={<FileJson />}
            subtitle="Store Target definitions in Argo without touching Project files."
            title="Manual setup"
          />
        </button>
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl border border-dashed px-4 py-3">
        <p className="type-label text-muted-foreground">
          You can open this Project now and finish setup later.
        </p>
        <Button onClick={actions.skipSetup} variant="ghost">
          Skip for now
        </Button>
      </div>
    </>
  )
}

function NoDefaultHarnessStage({ controller }: { controller: PrototypeController }) {
  const { actions } = controller
  const [choice, setChoice] = useState<'codex' | 'claude'>('codex')
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading description="Choose a default harness before Argo analyzes the Project. This choice also becomes the default for new Sessions.">
        Choose your default harness
      </StageHeading>
      <div className="mt-8 max-w-md space-y-3">
        <HarnessSelect label="Default harness" onChange={setChoice} value={choice} />
        <Button
          className="w-full"
          onClick={() => actions.configureDefaultHarness(choice)}
          size="lg"
        >
          Save default harness
        </Button>
      </div>
    </>
  )
}

function HarnessStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading description="Argo will start a short-lived agent that plans setup for this Project. It will not write files during planning.">
        Choose the setup agent
      </StageHeading>
      <div className="mt-8 max-w-lg rounded-xl border bg-card p-5 shadow-surface">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <HarnessSelect label="Harness" onChange={actions.setHarness} value={state.harness} />
            <p className="mt-3 type-label text-muted-foreground">
              The agent can read Project files. Argo applies changes in a separate phase that you
              start later.
            </p>
          </div>
        </div>
        <Button className="mt-5 w-full" onClick={actions.beginAnalysis} size="lg">
          Plan Project setup
        </Button>
      </div>
    </>
  )
}

function HarnessSelect({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: 'codex' | 'claude') => void
  value: 'codex' | 'claude'
}) {
  return (
    <div>
      <label className="mb-1.5 block type-body font-medium" htmlFor={`${label}-prototype`}>
        {label}
      </label>
      <Select
        items={HARNESS_CHOICES}
        onValueChange={(nextValue) => {
          if (nextValue === 'codex' || nextValue === 'claude') onChange(nextValue)
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={`${label}-prototype`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HARNESS_CHOICES.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function AnalyzingStage({ controller }: { controller: PrototypeController }) {
  const { state } = controller
  const progress = ((state.analysisStep + 1) / ANALYSIS_TASKS.length) * 100
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading description="The setup agent builds a plan. It does not write files, install dependencies, or run Project commands yet.">
        2 · Analyze the Project
      </StageHeading>
      <div className="mt-9 max-w-2xl">
        <p className="project-setup-shimmer type-heading" role="status">
          {ANALYSIS_TASKS[state.analysisStep]?.detail}
        </p>
        <Progress className="mt-5" value={progress}>
          <ProgressLabel>Planning</ProgressLabel>
          <span className="ml-auto type-label text-muted-foreground">
            {state.analysisStep + 1} of {ANALYSIS_TASKS.length}
          </span>
        </Progress>
        <PlanningTaskList current={state.analysisStep} />
      </div>
    </>
  )
}

function PlanningTaskList({ current }: { current: number }) {
  return (
    <ol className="prototype-task-list mt-7">
      {ANALYSIS_TASKS.map((task, index) => {
        const status = planningTaskStatus(index, current)
        return (
          <li data-status={status} key={task.label}>
            <TaskStatusIcon status={status} />
            <span>
              <strong>{task.label}</strong>
              <small>{task.detail}</small>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function planningTaskStatus(index: number, current: number): TaskStatus {
  if (index < current) return 'passed'
  if (index === current) return 'running'
  return 'pending'
}

function RecommendationsStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  if (state.planOutcome !== 'ready') return <PlanBoundary controller={controller} />
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading
        description={`The agent found ${runnableTargetCount(state.targets.length)} without changing the Project.`}
      >
        3 · Review {targetCount(state.targets.length)}
      </StageHeading>
      <div className="mt-7 space-y-4">
        {state.targets.map((target) => (
          <TargetSummary key={target.id} target={target} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button onClick={actions.openCustomization} variant="outline">
          Customize plan
        </Button>
        <Button onClick={actions.openProjectSetup}>Continue to Project setup</Button>
      </div>
    </>
  )
}

function PlanBoundary({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  if (state.planOutcome === 'needs-input') {
    return (
      <>
        <StageHeading description="The agent stopped before producing plan data because two Project folders look runnable.">
          Choose the main Project folder
        </StageHeading>
        <div className="mt-7 rounded-xl border bg-card p-5">
          <p className="type-body font-medium">Use packages as independent Targets?</p>
          <p className="mt-1 type-label text-muted-foreground">
            Your answer updates the plan. Argo did not apply any changes.
          </p>
          <Button className="mt-4" onClick={actions.resolvePlanInput}>
            Yes, use Project packages
          </Button>
        </div>
      </>
    )
  }
  if (state.planOutcome === 'cannot-plan') {
    return (
      <>
        <StageHeading description="The agent could not find a supported manifest or a safe command source. No partial plan is shown.">
          Setup needs another route
        </StageHeading>
        <div className="mt-6 flex gap-2">
          <Button onClick={actions.retryAnalysis} variant="outline">
            Analyze again
          </Button>
          <Button onClick={() => actions.chooseMethod('manual')}>Use manual JSON</Button>
        </div>
      </>
    )
  }
  return (
    <>
      <StageHeading description="Argo rejected the agent response at the boundary. Targets and recommendations are hidden so partial data cannot be applied.">
        The plan could not be read safely
      </StageHeading>
      <Button className="mt-6" onClick={actions.retryAnalysis}>
        Retry analysis
      </Button>
    </>
  )
}

export function RecommendationSummary({ controller }: { controller: PrototypeController }) {
  const proposed = [
    ...controller.state.repositoryRecommendations,
    ...controller.state.targets.flatMap(({ recommendations }) => recommendations),
  ]
  const accepted = proposed.filter(({ accepted: isAccepted }) => isAccepted).length
  const manual = controller.state.method === 'manual'
  return (
    <SectionCard icon={<Settings2 />} title="Plan summary">
      <SummaryRow
        detail={`${controller.state.targets.length}`}
        icon={<Package />}
        label="Targets"
      />
      <SummaryRow detail={manual ? '0' : `${accepted}`} icon={<Wrench />} label="Changes" />
      <SummaryRow
        detail={manual ? 'JSON structure validation' : `${controller.state.targets.length}`}
        icon={<TerminalSquare />}
        label="Checks"
      />
    </SectionCard>
  )
}

function TargetSummary({ target }: { target: PrototypeTarget }) {
  const acceptedRecommendations = target.recommendations.filter(({ accepted }) => accepted)
  return (
    <SectionCard
      className="prototype-target-card"
      icon={<Package />}
      subtitle={target.path}
      title={target.name}
    >
      <section className="prototype-found-area">
        <SubsectionHeader icon={<Code2 />} title="Current setup" />
        <div className="prototype-found-area__identity">
          <Fact label="Framework" value={target.framework} />
          <Fact label="Package manager" value={target.packageManager} />
        </div>
        <div className="prototype-target-card__commands">
          <CommandFact label="Start command" value={target.startCommand} />
          <CommandFact label="Build command" value={target.buildCommand} />
          <CommandFact label="Test command" value={target.testCommand} />
        </div>
        <div className="prototype-existing-tools">
          <small>Existing tools</small>
          <span>
            {target.existingTools.length ? (
              target.existingTools.join(' · ')
            ) : (
              <span className="type-label text-muted-foreground">None detected</span>
            )}
          </span>
        </div>
      </section>
      <section className="prototype-suggestions-area">
        <SubsectionHeader icon={<Sparkles />} title="The agent will add" />
        {acceptedRecommendations.length ? (
          acceptedRecommendations.map((recommendation) => (
            <SuggestionFact key={recommendation.id} recommendation={recommendation} />
          ))
        ) : (
          <p className="prototype-empty-suggestions">
            The agent proposed no changes for this Target.
          </p>
        )}
      </section>
    </SectionCard>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="prototype-found-fact">
      <small>{label}</small>
      <strong>{value || 'Not set'}</strong>
    </span>
  )
}

function CommandFact({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <code>{value || 'Not set'}</code>
    </span>
  )
}

const REPOSITORY_FOUND_FACTS = [
  { label: 'Harnesses', value: 'Codex · Claude Code' },
  { label: 'Project type', value: 'Bun monorepo' },
  { label: 'Quality', value: 'Biome · GitHub Actions' },
  { label: 'UI surface', value: 'Electron desktop' },
  { label: 'Workflow', value: 'Named worktrees' },
] as const

function RepositoryFoundFacts() {
  return (
    <SectionCard
      className="prototype-repository-card"
      icon={<GitBranch />}
      title="Found in this Project"
    >
      <div className="prototype-repository-facts">
        {REPOSITORY_FOUND_FACTS.map((fact) => (
          <Fact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </div>
    </SectionCard>
  )
}

function RepositorySummary({ recommendations }: { recommendations: PrototypeRecommendation[] }) {
  const acceptedRecommendations = recommendations.filter(({ accepted }) => accepted)
  return (
    <div className="space-y-3">
      <RepositoryFoundFacts />
      <SectionCard
        className="prototype-repository-card"
        icon={<Sparkles />}
        title="The agent will add"
      >
        <div className="prototype-suggestions-area">
          {acceptedRecommendations.map((recommendation) => (
            <SuggestionFact key={recommendation.id} recommendation={recommendation} />
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

const RECOMMENDATION_LINKS: Record<string, string> = {
  'agent-doc-audit': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
  'agent-instructions': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
  'argo-skill-bundle': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
  'codex-todos': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
  'guardrail-hooks': 'https://github.com/milad-alizadeh/argo',
  'interface-review': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
  'markdown-checks': 'https://github.com/DavidAnson/markdownlint-cli2',
  'matt-pocock': 'https://github.com/mattpocock/skills',
  'owned-skills': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
  playwright: 'https://playwright.dev/',
  'quality-gates': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
  'rtk-filters': 'https://github.com/milad-alizadeh/argo',
  storybook: 'https://storybook.js.org/',
  typedoc: 'https://typedoc.org/',
  'visual-direction': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
  'writing-skills': 'https://github.com/milad-alizadeh/argo/tree/main/packages/argo-skills',
}

function RecommendationLink({ recommendation }: { recommendation: PrototypeRecommendation }) {
  return (
    <a
      className="prototype-recommendation-link"
      href={RECOMMENDATION_LINKS[recommendation.id]}
      rel="noreferrer"
      target="_blank"
    >
      {recommendation.label}
    </a>
  )
}

const RECOMMENDATION_LOGOS: Record<string, string> = {
  playwright: new URL('./prototype-assets/playwright.svg', import.meta.url).href,
  storybook: new URL('./prototype-assets/storybook.svg', import.meta.url).href,
}

function RecommendationIcon({ recommendation }: { recommendation: PrototypeRecommendation }) {
  const source = RECOMMENDATION_LOGOS[recommendation.id]
  if (source) {
    return <img alt="" aria-hidden="true" className="prototype-tool-logo" src={source} />
  }
  return <Wrench aria-hidden="true" className="prototype-tool-logo" />
}

function RecommendationDependencies({
  recommendation,
}: {
  recommendation: PrototypeRecommendation
}) {
  if (!recommendation.bundledDependencies?.length && recommendation.kind === 'action') return null
  return (
    <span className="prototype-suggestion__dependencies">
      {recommendation.bundledDependencies?.length
        ? recommendation.bundledDependencies.map((dependency) => (
            <code key={dependency}>{dependency}</code>
          ))
        : 'No package change'}
    </span>
  )
}

function SuggestionFact({ recommendation }: { recommendation: PrototypeRecommendation }) {
  return (
    <div className="prototype-suggestion">
      <div className="prototype-suggestion__title">
        <RecommendationIcon recommendation={recommendation} />
        <strong>
          <RecommendationLink recommendation={recommendation} />
        </strong>
      </div>
      <p>{recommendation.reason}</p>
      <RecommendationDependencies recommendation={recommendation} />
    </div>
  )
}

function SummaryRow({ detail, icon, label }: { detail: string; icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0">
      <span className="grid size-8 place-items-center rounded-lg bg-muted [&_svg]:size-4">
        {icon}
      </span>
      <span className="type-body font-medium">{label}</span>
      <span className="ml-auto max-w-44 truncate type-label text-muted-foreground">{detail}</span>
    </div>
  )
}

function CustomizeStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading description="Keep only the Targets that matter. Each Target owns its path, commands, tools, dependencies, and verification.">
        Customize Targets and setup actions
      </StageHeading>
      <div className="mt-7 space-y-5">
        {state.targets.map((target) => (
          <TargetEditor controller={controller} key={target.id} target={target} />
        ))}
        <Button onClick={actions.addTarget} variant="outline">
          <Plus />
          Add Target
        </Button>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={actions.openProjectSetup}>Continue to Project setup</Button>
      </div>
    </>
  )
}

function ProjectSetupStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading description="Choose the Project-wide setup that Argo will apply.">
        4 · Customize Project setup
      </StageHeading>
      <div className="mt-7 space-y-5">
        <RepositoryFoundFacts />
        <RepositoryRecommendationGroups
          onToggle={actions.toggleRepositoryRecommendation}
          recommendations={state.repositoryRecommendations}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={actions.openReview}>Accept revision and review</Button>
      </div>
    </>
  )
}

function TargetEditor({
  controller,
  target,
}: {
  controller: PrototypeController
  target: PrototypeTarget
}) {
  const { actions } = controller
  return (
    <SectionCard
      action={
        <Button
          aria-label={`Remove ${target.name}`}
          onClick={() => actions.removeTarget(target.id)}
          size="icon-xs"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      }
      className="prototype-setting-section"
      icon={<Package />}
      subtitle={target.path}
      title={target.name}
    >
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <TargetField
          label="Target name"
          onChange={(name) => actions.updateTarget(target.id, { name })}
          value={target.name}
        />
        <TargetField
          label="Path from Project folder"
          onChange={(path) => actions.updateTarget(target.id, { path })}
          value={target.path}
        />
      </div>
      <div className="grid gap-4 border-t border-border/70 p-5 sm:grid-cols-3">
        <h3 className="type-heading sm:col-span-3">Commands</h3>
        <TargetField
          label="Start command"
          mono
          onChange={(startCommand) => actions.updateTarget(target.id, { startCommand })}
          value={target.startCommand}
        />
        <TargetField
          label="Build command"
          mono
          onChange={(buildCommand) => actions.updateTarget(target.id, { buildCommand })}
          value={target.buildCommand}
        />
        <TargetField
          label="Test command"
          mono
          onChange={(testCommand) => actions.updateTarget(target.id, { testCommand })}
          value={target.testCommand}
        />
      </div>
      {target.recommendations.length ? (
        <RecommendationEditor
          onToggle={(recommendationId) =>
            actions.toggleTargetRecommendation(target.id, recommendationId)
          }
          recommendations={target.recommendations}
          title="Suggested tools"
        />
      ) : null}
    </SectionCard>
  )
}

function TargetField({
  label,
  mono = false,
  onChange,
  value,
}: {
  label: string
  mono?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const inputId = useId()
  return (
    <div className="space-y-1.5 type-body font-medium">
      <label className="block" htmlFor={inputId}>
        {label}
      </label>
      <Input
        className={mono ? 'font-mono' : undefined}
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  )
}

function RecommendationEditor({
  onToggle,
  recommendations,
  title,
}: {
  onToggle: (recommendationId: string) => void
  recommendations: PrototypeRecommendation[]
  title: string
}) {
  return (
    <SectionCard className="prototype-recommendation-editor" icon={<Wrench />} title={title}>
      <div>
        {recommendations.map((recommendation) => (
          <OptionRow
            action={
              <Switch
                aria-label={`Accept ${recommendation.label}`}
                checked={recommendation.accepted}
                onCheckedChange={() => onToggle(recommendation.id)}
              />
            }
            detail={
              <>
                <span>{recommendation.reason}</span>
                <RecommendationDependencies recommendation={recommendation} />
              </>
            }
            icon={<RecommendationIcon recommendation={recommendation} />}
            key={recommendation.id}
            title={<RecommendationLink recommendation={recommendation} />}
          />
        ))}
      </div>
    </SectionCard>
  )
}

const REPOSITORY_RECOMMENDATION_GROUPS = [
  {
    ids: ['argo-skill-bundle', 'owned-skills', 'rtk-filters', 'guardrail-hooks'],
    title: 'Project tooling',
  },
  {
    ids: ['quality-gates'],
    title: 'Code quality',
  },
  {
    ids: ['interface-review', 'visual-direction'],
    title: 'Interface development',
  },
  {
    ids: ['codex-todos', 'agent-instructions', 'matt-pocock', 'writing-skills', 'agent-doc-audit'],
    title: 'Agent workflow',
  },
] as const

function RepositoryRecommendationGroups({
  onToggle,
  recommendations,
}: {
  onToggle: (recommendationId: string) => void
  recommendations: PrototypeRecommendation[]
}) {
  return REPOSITORY_RECOMMENDATION_GROUPS.map((group) => (
    <RecommendationEditor
      key={group.title}
      onToggle={onToggle}
      recommendations={group.ids.flatMap((id) =>
        recommendations.filter((recommendation) => recommendation.id === id),
      )}
      title={group.title}
    />
  ))
}

function ManualTargetSummary({ target }: { target: PrototypeTarget }) {
  return (
    <SectionCard
      className="prototype-target-card prototype-manual-target-card"
      icon={<FileJson />}
      subtitle={target.path || 'No path set'}
      title={target.name}
    >
      <div className="prototype-target-card__commands">
        <CommandFact label="Start command" value={target.startCommand} />
        <CommandFact label="Build command" value={target.buildCommand} />
        <CommandFact label="Test command" value={target.testCommand} />
      </div>
      <p className="prototype-manual-target-card__note">
        Argo validates only the JSON structure. It did not inspect or run these commands.
      </p>
    </SectionCard>
  )
}

function ManualStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  const parsedTargets = targetsFromManualSource(state.manualSource)
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading description="Paste Target definitions for this Project. Argo validates only the JSON structure. It does not inspect or run commands, change files, or install anything.">
        Import Target configuration
      </StageHeading>
      <SectionCard
        className="mt-7"
        icon={<FileJson />}
        subtitle="Empty Targets and commands are allowed."
        title="Target configuration JSON"
      >
        <div className="p-4">
          <Textarea
            aria-invalid={parsedTargets === null}
            aria-label="Project Target configuration"
            className="prototype-manual-source font-mono"
            onChange={(event) => actions.setManualSource(event.target.value)}
            value={state.manualSource}
          />
        </div>
      </SectionCard>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className={`type-label ${parsedTargets ? 'text-muted-foreground' : 'text-destructive'}`}>
          {manualStatus(parsedTargets, state.manualValidated)}
        </p>
        <div className="flex gap-2">
          <Button
            disabled={parsedTargets === null}
            onClick={actions.validateManualSource}
            variant="outline"
          >
            Validate JSON
          </Button>
          <Button disabled={!state.manualValidated} onClick={actions.openReview}>
            Review configuration
          </Button>
        </div>
      </div>
      {state.manualValidated && state.targets.length > 0 ? (
        <div className="mt-7 space-y-3">
          {state.targets.map((target) => (
            <ManualTargetSummary key={target.id} target={target} />
          ))}
        </div>
      ) : null}
    </>
  )
}

function manualStatus(targets: PrototypeTarget[] | null, validated: boolean) {
  if (!targets) return 'Use a JSON object with a targets object. Target fields must be strings.'
  if (validated) return 'The JSON structure is valid.'
  return `${targetCount(targets.length)} found. Empty Targets and commands are allowed.`
}

function ReviewStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  const manual = state.method === 'manual'
  return (
    <>
      <BackAction controller={controller} />
      <StageHeading
        description={
          manual
            ? 'Argo will save this JSON configuration and open the Project. It will not inspect or run commands, change files, or install anything.'
            : 'Argo will apply the setup. It will install the accepted tools and dependencies. Then it will verify each Target before it starts the Project.'
        }
      >
        5 · Review {targetCount(state.targets.length)} for argo
      </StageHeading>
      <div className="mt-7 space-y-4">
        {state.targets.map((target) =>
          manual ? (
            <ManualTargetSummary key={target.id} target={target} />
          ) : (
            <TargetSummary key={target.id} target={target} />
          ),
        )}
        {manual && state.targets.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="type-heading">No Targets yet</p>
            <p className="mt-1 type-label text-muted-foreground">
              This is a valid setup. Targets and commands can be added later.
            </p>
          </div>
        ) : null}
        {!manual ? <RepositorySummary recommendations={state.repositoryRecommendations} /> : null}
      </div>
      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-4 py-3">
        <p className="type-label text-muted-foreground">
          {manual
            ? 'Manual setup stores configuration in Argo only.'
            : 'Argo applies changes in a separate tracked phase. It starts the Project only after the required tasks pass.'}
        </p>
        <div className="flex gap-2">
          {!manual ? (
            <Button onClick={actions.openCustomization} variant="outline">
              Customize
            </Button>
          ) : null}
          <Button
            disabled={!manual && !state.planRevisionAccepted}
            onClick={actions.apply}
            size="lg"
          >
            {manual ? 'Save and open Project' : 'Apply and verify'}
          </Button>
        </div>
      </div>
    </>
  )
}

function ApplyStage({ controller }: { controller: PrototypeController }) {
  const { state } = controller
  return (
    <>
      <StageHeading description="A new agent applies each accepted change. Then it verifies each required Target.">
        6 · Apply and verify the setup plan
      </StageHeading>
      <ApplyTaskList controller={controller} />
      {state.waitingTaskId ? (
        <div className="mt-5 flex items-center justify-between rounded-xl border bg-card p-4">
          <p className="type-label text-muted-foreground">
            The agent is waiting for your choices for issue tracking and the layout of domain
            documentation.
          </p>
          <Button onClick={controller.actions.continueApply}>Confirm choices and continue</Button>
        </div>
      ) : null}
    </>
  )
}

function ApplyFailedStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  const failed = state.targets.find(({ id }) => id === state.failureTargetId)
  return (
    <>
      <StageHeading
        description={`${failed?.name ?? 'A Target'} failed a required task. Fix its setup or retry the failed task before Argo starts this Project.`}
      >
        Target verification failed
      </StageHeading>
      <ApplyTaskList controller={controller} />
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={actions.editFailedTarget} variant="outline">
          Edit failed Target
        </Button>
        <Button onClick={actions.retryApply}>Retry failed task</Button>
      </div>
    </>
  )
}

function ApplyTaskList({ controller }: { controller: PrototypeController }) {
  const { state } = controller
  const tasks = applyTasksFor(state)
  return (
    <ol className="prototype-task-list mt-8">
      {tasks.map((task, index) => {
        const status = applyTaskStatus(task, index, state)
        return (
          <li data-status={status} key={task.id}>
            <OptionRow
              detail={task.detail}
              icon={<TaskStatusIcon status={status} />}
              title={task.label}
            />
          </li>
        )
      })}
    </ol>
  )
}

type TaskStatus = 'pending' | 'running' | 'waiting' | 'passed' | 'failed'

function applyTaskStatus(
  task: PrototypeApplyTask,
  index: number,
  state: PrototypeController['state'],
): TaskStatus {
  if (index < state.applyStep) return 'passed'
  if (index > state.applyStep) return 'pending'
  if (state.stage === 'apply-failed' && task.targetId === state.failureTargetId) return 'failed'
  if (state.waitingTaskId === task.id) return 'waiting'
  return 'running'
}

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="size-4" />
    case 'running':
      return <LoaderCircle className="size-4 animate-spin" />
    case 'waiting':
      return <Circle className="size-4 fill-foreground/10" />
    case 'passed':
      return <CheckCircle2 className="size-4" />
    case 'failed':
      return <XCircle className="size-4" />
  }
}

function StartingStage({ controller }: { controller: PrototypeController }) {
  return (
    <div className="flex min-h-96 flex-col items-center justify-center text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted">
        <Play className="size-6" />
      </span>
      <h1 className="prototype-stage-heading mt-5 type-title" tabIndex={-1}>
        Starting the Project
      </h1>
      <p className="project-setup-shimmer mt-2 type-body" role="status">
        All required tasks passed. Exposing {targetCount(controller.state.targets.length)}…
      </p>
    </div>
  )
}

function CompleteStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  if (state.skippedSetup) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-muted">
          <FolderOpen className="size-6" />
        </span>
        <h1 className="prototype-stage-heading mt-5 type-title font-heading" tabIndex={-1}>
          argo is open
        </h1>
        <p className="mt-2 max-w-lg type-body text-muted-foreground">
          Setup was skipped. This Project has no required Targets or configuration yet.
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={actions.finishSetup}>Finish setup</Button>
          <Button onClick={() => actions.openEntry('selector')} variant="outline">
            Open Project
          </Button>
        </div>
      </div>
    )
  }
  if (state.method === 'manual') return <ManualCompleteStage controller={controller} />
  return (
    <>
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-diff-added/10 text-diff-added">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="prototype-stage-heading mt-5 type-title font-heading" tabIndex={-1}>
          argo is running
        </h1>
        <p className="mt-2 type-body text-muted-foreground">
          Required tasks passed. These Targets are now available to Sessions.
        </p>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {state.targets.map((target) => (
          <SectionCard
            icon={<Package />}
            key={target.id}
            subtitle={target.path}
            title={target.name}
          >
            <code className="m-4 block rounded-lg bg-muted px-3 py-2 type-code">
              {target.startCommand}
            </code>
          </SectionCard>
        ))}
      </div>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={() => actions.openEntry('selector')}>Open Project</Button>
        <Button onClick={actions.reset} variant="outline">
          Restart prototype
        </Button>
      </div>
    </>
  )
}

function ManualCompleteStage({ controller }: { controller: PrototypeController }) {
  const { actions, state } = controller
  return (
    <>
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
          <FileJson className="size-7" />
        </span>
        <h1 className="prototype-stage-heading mt-5 type-title font-heading" tabIndex={-1}>
          Manual configuration saved
        </h1>
        <p className="mx-auto mt-2 max-w-2xl type-body text-muted-foreground">
          The configuration was saved. Argo did not inspect or run commands. Argo did not start or
          mark any Target as ready.
        </p>
      </div>
      {state.targets.length > 0 ? (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {state.targets.map((target) => (
            <SectionCard
              icon={<Package />}
              key={target.id}
              subtitle={target.path || 'No path set'}
              title={target.name}
            >
              <p className="px-4 py-3 type-label text-muted-foreground">Stored in Argo</p>
            </SectionCard>
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-7 max-w-xl rounded-xl border border-dashed p-5 text-center">
          <p className="type-heading">No Targets configured</p>
          <p className="mt-1 type-label text-muted-foreground">
            You can add Target definitions later.
          </p>
        </div>
      )}
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={() => actions.openEntry('selector')}>Open Project</Button>
        <Button onClick={actions.reset} variant="outline">
          Restart prototype
        </Button>
      </div>
    </>
  )
}

export function SetupEvidence({ controller }: { controller: PrototypeController }) {
  const { state } = controller
  return (
    <div className="space-y-3">
      <h2 className="type-heading">Setup evidence</h2>
      <EvidenceRow icon={<GitBranch />} label="Project" value="Project folder" />
      <EvidenceRow
        icon={<Package />}
        label="Targets"
        value={runnableTargetCount(state.targets.length)}
      />
      <EvidenceRow icon={<Code2 />} label="Stack" value="Bun · Electron · Markdown" />
      <EvidenceRow icon={<Settings2 />} label="Last action" value={state.event} />
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

export function AgentTimeline({ controller }: { controller: PrototypeController }) {
  const { state } = controller
  const applying = ['applying', 'apply-failed', 'starting', 'complete'].includes(state.stage)
  const items = [
    { complete: state.stage !== 'folder', label: 'Project folder selected' },
    { complete: Boolean(state.method), label: 'Setup method chosen' },
    {
      complete: !['folder', 'method', 'no-default', 'harness', 'analyzing'].includes(state.stage),
      label: 'Targets and plan prepared',
    },
    { complete: applying, label: 'Setup approved' },
    {
      complete: state.stage === 'complete',
      label: state.method === 'manual' || state.skippedSetup ? 'Project opened' : 'Project started',
    },
  ]
  return (
    <ol className="prototype-agent-timeline">
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
