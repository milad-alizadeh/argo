import { ChevronDown } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'

export function ProjectOnboardingShell({
  accessibleName,
  children,
  contentRef,
  event,
  header,
  introduction,
  sidebar,
  sidebarDisclosureLabel,
}: {
  accessibleName: string
  children: ReactNode
  contentRef: RefObject<HTMLElement | null>
  event: ReactNode
  header: ReactNode
  introduction: ReactNode
  sidebar: ReactNode
  sidebarDisclosureLabel: string
}) {
  return (
    <main aria-label={accessibleName} className="onboarding-briefing">
      <header className="onboarding-briefing__chrome drag-region">{header}</header>
      <div className="onboarding-briefing__workspace">
        <section className="onboarding-briefing__conversation" ref={contentRef}>
          <div className="onboarding-briefing__message onboarding-briefing__message--agent">
            {introduction}
          </div>
          <div className="onboarding-briefing__message onboarding-briefing__message--event">
            {event}
          </div>
          <details className="onboarding-briefing__artifact-disclosure">
            <summary>
              <span>{sidebarDisclosureLabel}</span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="onboarding-briefing__artifact-disclosure-body">{sidebar}</div>
          </details>
          <div className="onboarding-briefing__response">{children}</div>
        </section>
        <aside className="onboarding-briefing__artifact">{sidebar}</aside>
      </div>
    </main>
  )
}

export function ProjectOnboardingStageHeader({
  back,
  children,
  description,
}: {
  back?: ReactNode
  children: ReactNode
  description: string
}) {
  return (
    <header>
      {back}
      <h1
        className="onboarding-stage-heading type-title font-heading text-foreground"
        tabIndex={-1}
      >
        {children}
      </h1>
      <p className="mt-2 max-w-2xl type-body text-muted-foreground">{description}</p>
    </header>
  )
}

export function ProjectOnboardingStageContent({ children }: { children: ReactNode }) {
  return <div className="mt-7">{children}</div>
}

export function ProjectOnboardingStageActions({
  children,
  note,
}: {
  children: ReactNode
  note?: ReactNode
}) {
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-end gap-2">
      {note ? <div className="mr-auto min-w-0">{note}</div> : null}
      {children}
    </footer>
  )
}
