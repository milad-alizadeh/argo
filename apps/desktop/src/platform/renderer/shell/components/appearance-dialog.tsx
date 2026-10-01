import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  APPEARANCES,
  type AppearancePreference,
  type AppearanceState,
  THEMES,
} from '@/platform/contract/appearance'
import { Icon } from '../../components/icon/icon'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Field, FieldLabel, FieldLegend, FieldSet } from '../../components/ui/field'
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'

export function AppearanceDialog({
  state,
  open,
  onOpenChange,
  onChoose,
}: {
  state: AppearanceState
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (preference: AppearancePreference) => Promise<boolean>
}) {
  const { t } = useTranslation('app')
  const [pending, setPending] = useState(false)
  const [rejected, setRejected] = useState(false)
  async function choose(preference: AppearancePreference) {
    setPending(true)
    setRejected(false)
    try {
      setRejected(!(await onChoose(preference)))
    } catch {
      setRejected(true)
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('appearance.title')}</DialogTitle>
          <DialogDescription>{t('appearance.description')}</DialogDescription>
        </DialogHeader>
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2"
              aria-label={t('appearance.close')}
            />
          }
        >
          <Icon name="close" />
        </DialogClose>
        <FieldSet disabled={pending}>
          <FieldLegend>{t('appearance.theme')}</FieldLegend>
          <RadioGroup
            aria-label={t('appearance.theme')}
            value={state.theme}
            disabled={pending}
            onValueChange={(theme) => {
              const selected = THEMES.find((candidate) => candidate === theme)
              if (selected) void choose({ theme: selected, appearance: state.appearance })
            }}
          >
            {THEMES.map((theme) => (
              <Field key={theme} orientation="horizontal">
                <RadioGroupItem id={`appearance-theme-${theme}`} value={theme} />
                <FieldLabel htmlFor={`appearance-theme-${theme}`}>
                  {t(`appearance.themes.${theme}`)}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
        <FieldSet disabled={pending}>
          <FieldLegend>{t('appearance.mode')}</FieldLegend>
          <RadioGroup
            aria-label={t('appearance.mode')}
            value={state.appearance}
            disabled={pending}
            onValueChange={(appearance) => {
              const selected = APPEARANCES.find((candidate) => candidate === appearance)
              if (selected) void choose({ theme: state.theme, appearance: selected })
            }}
          >
            {APPEARANCES.map((appearance) => (
              <Field key={appearance} orientation="horizontal">
                <RadioGroupItem id={`appearance-mode-${appearance}`} value={appearance} />
                <FieldLabel htmlFor={`appearance-mode-${appearance}`}>
                  {t(`appearance.modes.${appearance}`)}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
        {rejected && (
          <p role="alert" className="text-sm text-destructive">
            {t('appearance.rejected')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
