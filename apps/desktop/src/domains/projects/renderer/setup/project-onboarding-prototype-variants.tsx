// THROWAWAY PROTOTYPE (#2464): three intentionally different structures for one onboarding flow.
import { Bot, ChevronDown, Folder, PanelRight, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { CockpitShell } from '@/platform/renderer/cockpit/components/cockpit-shell'
import type { PrototypeController } from './project-onboarding-prototype'
import {
  AgentTimeline,
  ProjectEntryScene,
  RecommendationSummary,
  RepresentativeSessionSidebar,
  SetupEvidence,
  SetupProgress,
  SetupStageContent,
} from './project-onboarding-prototype-parts'

export function ProjectOnboardingVariantA({ controller }: { controller: PrototypeController }) {
  if (controller.state.stage === 'entry') return <ProjectEntryScene controller={controller} />
  return (
    <main className="prototype-runway" aria-label="Project onboarding prototype, setup runway">
      <header className="prototype-runway__chrome drag-region">
        <div className="no-drag-region flex items-center gap-2">
          <Folder className="size-4" />
          <span className="type-heading">Set up argo</span>
        </div>
      </header>
      <div className="prototype-runway__workspace">
        <aside className="prototype-runway__steps">
          <p className="mb-4 px-3 type-label text-muted-foreground">
            One decision at a time. You can go back without losing your choices.
          </p>
          <SetupProgress stage={controller.state.stage} />
        </aside>
        <section className="prototype-runway__stage">
          <div className="mx-auto w-full max-w-4xl">
            <SetupStageContent controller={controller} presentation="runway" />
          </div>
        </section>
      </div>
    </main>
  )
}

export function ProjectOnboardingVariantB({ controller }: { controller: PrototypeController }) {
  if (controller.state.stage === 'entry') return <ProjectEntryScene controller={controller} />
  return (
    <CockpitShell
      header={<InspectorProjectHeader />}
      sidebar={<InspectorSidebar controller={controller} />}
    >
      <main
        className="prototype-inspector"
        aria-label="Project onboarding prototype, cockpit inspector"
      >
        <header className="prototype-inspector__header drag-region">
          <div>
            <span className="type-label text-muted-foreground">/Users/milad/Developer/argo</span>
            <h1 className="mt-2 type-title">Prepare argo for agent Sessions</h1>
          </div>
          <PanelRight className="size-4 text-muted-foreground" />
        </header>
        <div className="prototype-inspector__workspace">
          <section className="prototype-inspector__stage">
            <SetupStageContent controller={controller} presentation="inspector" />
          </section>
          <aside className="prototype-inspector__evidence">
            <SetupEvidence controller={controller} />
            {[
              'recommendations',
              'customize',
              'project-setup',
              'review',
              'applying',
              'apply-failed',
              'starting',
              'complete',
            ].includes(controller.state.stage) ? (
              <div className="mt-7">
                <h2 className="mb-3 type-heading">Current plan</h2>
                <RecommendationSummary controller={controller} />
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </CockpitShell>
  )
}

function InspectorProjectHeader() {
  return (
    <div className="flex items-center gap-2 px-2 type-body font-medium">
      <Folder className="size-4" />
      argo
    </div>
  )
}

function InspectorSidebar({ controller }: { controller: PrototypeController }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="flex items-center gap-2 type-heading">
          <Sparkles className="size-4" />
          Project setup
        </div>
        <p className="mt-1 type-label text-muted-foreground">A live checklist for this Project.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <SetupProgress stage={controller.state.stage} />
        <div className="my-5 border-t border-border/60" />
        <RepresentativeSessionSidebar />
      </div>
    </div>
  )
}

export function ProjectOnboardingVariantC({ controller }: { controller: PrototypeController }) {
  const conversationRef = useRef<HTMLElement>(null)
  const previousStageRef = useRef(controller.state.stage)

  useEffect(() => {
    if (previousStageRef.current === controller.state.stage) return
    previousStageRef.current = controller.state.stage
    const conversation = conversationRef.current
    if (!conversation) return
    conversation.scrollTop = 0
    const animationFrame = window.requestAnimationFrame(() => {
      conversation.querySelector<HTMLElement>('.prototype-stage-heading')?.focus({
        preventScroll: true,
      })
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [controller.state.stage])

  if (controller.state.stage === 'entry') return <ProjectEntryScene controller={controller} />
  return (
    <main className="prototype-briefing" aria-label="Project onboarding prototype, agent briefing">
      <header className="prototype-briefing__chrome drag-region">
        <div className="no-drag-region flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </span>
          <div>
            <h1 className="type-heading">Project setup agent</h1>
            <p className="type-meta text-muted-foreground">argo · plan, then make changes</p>
          </div>
        </div>
      </header>
      <div className="prototype-briefing__workspace">
        <section className="prototype-briefing__conversation" ref={conversationRef}>
          <div className="prototype-briefing__message prototype-briefing__message--agent">
            <span className="prototype-briefing__avatar">
              <Sparkles className="size-4" />
            </span>
            <p>
              I will help prepare this Project for agent Sessions. You approve every choice before I
              apply the setup.
            </p>
          </div>
          <div className="prototype-briefing__message prototype-briefing__message--event">
            <span className="prototype-briefing__avatar">
              <Folder className="size-4" />
            </span>
            <p>{controller.state.event}</p>
          </div>
          <details className="prototype-briefing__artifact-disclosure">
            <summary>
              <span>Plan summary and progress</span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="prototype-briefing__artifact-disclosure-body">
              <BriefingArtifact controller={controller} />
            </div>
          </details>
          <div className="prototype-briefing__response">
            <SetupStageContent controller={controller} presentation="briefing" />
          </div>
        </section>
        <aside className="prototype-briefing__artifact">
          <BriefingArtifact controller={controller} />
        </aside>
      </div>
    </main>
  )
}

function BriefingArtifact({ controller }: { controller: PrototypeController }) {
  return (
    <>
      <h2 className="type-heading">Live setup artifact</h2>
      <div className="mt-5">
        <RecommendationSummary controller={controller} />
      </div>
      <div className="mt-7 border-t border-border/60 pt-5">
        <AgentTimeline controller={controller} />
      </div>
    </>
  )
}
