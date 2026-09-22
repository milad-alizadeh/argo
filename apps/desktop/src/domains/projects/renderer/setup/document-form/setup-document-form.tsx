import { useState } from 'react'
import { type SetupDocument, setupConfiguration } from '@/domains/projects/contract/setup'
import { setupSections } from '../plan/setup-plan-sections'
import { CustomizeSetup } from '../screens/customize-setup'
import { ImportSetup } from '../screens/import-setup'
import { RecommendedSetup } from '../screens/recommended-setup'
import { useSetupAnswers } from '../use-setup-answers'

type SetupMode = 'recommended' | 'customize' | 'manual'

export function SetupDocumentForm({
  applyConfiguration,
  configurationSource,
  document,
  language,
  onConfigurationChange,
  saving,
  testConfiguration,
}: {
  applyConfiguration: () => Promise<void>
  configurationSource: string
  document: SetupDocument
  language: string
  onConfigurationChange: (source: string) => void
  saving: 'apply' | 'test' | null
  testConfiguration: () => Promise<void>
}) {
  const [mode, setMode] = useState<SetupMode>('recommended')
  const { answers, update } = useSetupAnswers(document, configurationSource, (nextAnswers) =>
    onConfigurationChange(setupConfiguration(document, nextAnswers, configurationSource)),
  )
  const shared = {
    applyConfiguration,
    configurationSource,
    saving,
    testConfiguration,
  }
  switch (mode) {
    case 'recommended':
      return (
        <RecommendedSetup
          {...shared}
          answers={answers}
          document={document}
          language={language}
          openCustomization={() => setMode('customize')}
          openManual={() => setMode('manual')}
          sections={setupSections(document)}
        />
      )
    case 'customize':
      return (
        <CustomizeSetup
          {...shared}
          answers={answers}
          document={document}
          language={language}
          onBack={() => setMode('recommended')}
          sections={setupSections(document)}
          update={update}
        />
      )
    case 'manual':
      return (
        <ImportSetup
          {...shared}
          onBack={() => setMode('recommended')}
          onConfigurationChange={onConfigurationChange}
        />
      )
  }
}
