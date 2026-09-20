import { CheckCircle2, Circle, FileJson, FolderOpen, Sparkles } from 'lucide-react'
import { Button } from '@/platform/renderer/components/ui/button'
import type { OnboardingController } from './project-onboarding'
import { HarnessSelect } from './project-onboarding-harness-stage'
import { ProjectOnboardingStageHeader as StageHeading } from './project-onboarding-layout'
import { BackAction, SectionCard, SectionCardHeader } from './project-onboarding-primitives'

export function FolderStage({ controller }: { controller: OnboardingController }) {
  const { actions, state } = controller
  return (
    <>
      <StageHeading description="Choose the Project folder. Argo will find Targets inside it.">
        Choose a Project folder
      </StageHeading>
      <button
        className="onboarding-folder-choice mt-8"
        onClick={actions.chooseFolder}
        type="button"
      >
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

export function MethodStage({ controller }: { controller: OnboardingController }) {
  const { actions, state } = controller
  const defaultHarnessLabel = state.defaultHarness === 'claude' ? 'Claude Code' : 'Codex'
  return (
    <>
      <StageHeading
        back={<BackAction controller={controller} />}
        description="Ask an agent to find Targets and recommend setup, or define Target commands without changing Project files."
      >
        1 · Choose a setup method
      </StageHeading>
      <div className="onboarding-method-grid mt-8">
        <SectionCard
          className="onboarding-agent-method-card"
          icon={<Sparkles />}
          subtitle="A harness is the app that Argo uses to run an agent."
          title="Set up with an agent"
        >
          <div className="onboarding-agent-method-card__controls">
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
          className="onboarding-method-choice onboarding-section-card"
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
