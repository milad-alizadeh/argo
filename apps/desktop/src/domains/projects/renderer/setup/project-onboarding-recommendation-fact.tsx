import {
  CheckCircle2,
  FileCog,
  FileJson,
  ListChecks,
  Palette,
  PenLine,
  ScanEye,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { OnboardingRecommendation } from './project-onboarding'
import { recommendationText } from './project-onboarding-copy'

const recommendationLogos: Record<string, string> = {
  playwright: new URL('./onboarding-assets/playwright.svg', import.meta.url).href,
  storybook: new URL('./onboarding-assets/storybook.svg', import.meta.url).href,
}
const recommendationIcons: Record<string, ReactNode> = {
  'argo-skills': <Sparkles aria-hidden="true" className="onboarding-tool-logo" />,
  audit: <SearchCheck aria-hidden="true" className="onboarding-tool-logo" />,
  docs: <FileJson aria-hidden="true" className="onboarding-tool-logo" />,
  guards: <ShieldCheck aria-hidden="true" className="onboarding-tool-logo" />,
  'interface-review': <ScanEye aria-hidden="true" className="onboarding-tool-logo" />,
  'project-docs': <FileCog aria-hidden="true" className="onboarding-tool-logo" />,
  quality: <CheckCircle2 aria-hidden="true" className="onboarding-tool-logo" />,
  tasks: <ListChecks aria-hidden="true" className="onboarding-tool-logo" />,
  terminal: <TerminalSquare aria-hidden="true" className="onboarding-tool-logo" />,
  'visual-direction': <Palette aria-hidden="true" className="onboarding-tool-logo" />,
  workflow: <Workflow aria-hidden="true" className="onboarding-tool-logo" />,
  writing: <PenLine aria-hidden="true" className="onboarding-tool-logo" />,
}

export function RecommendationLink({
  recommendation,
}: {
  recommendation: OnboardingRecommendation
}) {
  return (
    <a
      className="onboarding-recommendation-link"
      href={recommendation.href}
      rel="noreferrer"
      target="_blank"
    >
      {recommendationText(recommendation, 'label')}
    </a>
  )
}

export function RecommendationIcon({
  recommendation,
}: {
  recommendation: OnboardingRecommendation
}) {
  const source = recommendationLogos[recommendation.icon]
  return source ? (
    <img alt="" aria-hidden="true" className="onboarding-tool-logo" src={source} />
  ) : (
    (recommendationIcons[recommendation.icon] ?? (
      <Wrench aria-hidden="true" className="onboarding-tool-logo" />
    ))
  )
}

function RecommendationDependencies({
  recommendation,
}: {
  recommendation: OnboardingRecommendation
}) {
  return recommendation.bundledDependencies?.length ? (
    <span className="onboarding-suggestion__dependencies">
      {recommendation.bundledDependencies.map((dependency) => (
        <code key={dependency}>{dependency}</code>
      ))}
    </span>
  ) : null
}

export function SuggestionFact({
  detail = 'reason',
  recommendation,
}: {
  detail?: 'effect' | 'reason'
  recommendation: OnboardingRecommendation
}) {
  return (
    <div className="onboarding-suggestion">
      <div className="onboarding-suggestion__title">
        <RecommendationIcon recommendation={recommendation} />
        <strong>
          <RecommendationLink recommendation={recommendation} />
        </strong>
      </div>
      <p>
        {detail === 'effect' && recommendation.effect
          ? recommendation.effect
          : recommendationText(recommendation, 'reason')}
      </p>
      <RecommendationDependencies recommendation={recommendation} />
    </div>
  )
}

export function RecommendationDetail({
  recommendation,
}: {
  recommendation: OnboardingRecommendation
}) {
  return (
    <>
      <span>{recommendationText(recommendation, 'reason')}</span>
      <RecommendationDependencies recommendation={recommendation} />
    </>
  )
}
