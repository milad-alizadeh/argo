import { useTranslation } from 'react-i18next'
import { Separator } from '@/renderer/components/ui/separator'

export function ProjectSetupSteps({ projectName }: { projectName: string }) {
  const { t } = useTranslation('projects')
  const steps = [t('setup.configurationLabel'), t('setup.save'), t('setup.test')]
  return (
    <>
      <Separator className="my-5" />
      <ol className="flex flex-col gap-1" aria-label={t('setup.label', { name: projectName })}>
        {steps.map((step, index) => (
          <li
            className={
              index === 0
                ? 'flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-foreground'
                : 'flex items-center gap-2 px-2 py-1.5 text-muted-foreground'
            }
            key={step}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current type-meta">
              {index + 1}
            </span>
            <span className="type-body">{step}</span>
          </li>
        ))}
      </ol>
    </>
  )
}
