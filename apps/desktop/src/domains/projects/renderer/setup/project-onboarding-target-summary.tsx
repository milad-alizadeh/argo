import { Code2, Package, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { OnboardingTarget } from './project-onboarding'
import { onboardingText } from './project-onboarding-copy'
import { SectionCard, SubsectionHeader } from './project-onboarding-primitives'
import { SuggestionFact } from './project-onboarding-recommendation-fact'

export function TargetSummary({ target }: { target: OnboardingTarget }) {
  const { t } = useTranslation('projects')
  const accepted = target.recommendations.filter((recommendation) => recommendation.accepted)
  return (
    <SectionCard
      className="onboarding-target-card"
      icon={<Package />}
      subtitle={target.path}
      title={target.name}
    >
      <section className="onboarding-found-area">
        <SubsectionHeader icon={<Code2 />} title={t('onboarding.target.currentSetup')} />
        <div className="onboarding-found-area__identity">
          <Fact label={t('onboarding.target.framework')} value={target.framework} />
          <Fact label={t('onboarding.target.packageManager')} value={target.packageManager} />
        </div>
        <div className="onboarding-target-card__commands">
          <CommandFact label={t('onboarding.target.startCommand')} value={target.startCommand} />
          <CommandFact label={t('onboarding.target.buildCommand')} value={target.buildCommand} />
          <CommandFact label={t('onboarding.target.testCommand')} value={target.testCommand} />
        </div>
        <div className="onboarding-existing-tools">
          <small>{t('onboarding.target.existingTools')}</small>
          <span>
            {target.existingTools.length ? (
              target.existingTools.join(' · ')
            ) : (
              <span className="type-label text-muted-foreground">
                {t('onboarding.target.noneDetected')}
              </span>
            )}
          </span>
        </div>
      </section>
      <section className="onboarding-suggestions-area">
        <SubsectionHeader icon={<Sparkles />} title={t('onboarding.target.agentWillAdd')} />
        {accepted.length ? (
          accepted.map((recommendation) => (
            <SuggestionFact key={recommendation.id} recommendation={recommendation} />
          ))
        ) : (
          <p className="onboarding-empty-suggestions">{t('onboarding.target.noSuggestions')}</p>
        )}
      </section>
    </SectionCard>
  )
}

export function CommandFact({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <code>{value || onboardingText('onboarding.notSet')}</code>
    </span>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="onboarding-found-fact">
      <small>{label}</small>
      <strong>{value || onboardingText('onboarding.notSet')}</strong>
    </span>
  )
}
