import type { Meta, StoryObj } from '@storybook/react-vite'
import { useCallback, useEffect, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { claudeComposerModelCatalogFixture } from '@/mocks/sessions/claude-model-catalog.fixture'
import { claudeChoices } from '@/mocks/sessions/harness-catalog.fixture'
import { ComposerForm } from '../composer/layout/composer-form'
import type { TurnConfigurationChoices } from '../composer/turn-configuration/turn-configuration'
import { useComposerFailureToasts } from './use-composer-failure-toasts'

const choices = claudeChoices(claudeComposerModelCatalogFixture())
if (choices === null) throw new Error('The Claude story catalog has no usable model.')
const availableChoices = choices as TurnConfigurationChoices

let failCatalogRead: () => void

function ComposerCatalogRecovery() {
  const [state, setState] = useState<'loading' | 'failed' | 'ready'>('loading')
  const [focusOnReady, setFocusOnReady] = useState(false)
  useEffect(() => {
    failCatalogRead = () => setState('failed')
  }, [])
  const clearRecoveryFocus = useCallback(() => setFocusOnReady(false), [])
  useComposerFailureToasts(
    state === 'failed'
      ? [
          {
            scope: 'catalog:claude',
            title: 'Argo could not load Claude Code models. Try again.',
            retry: () => {
              setFocusOnReady(true)
              setState('ready')
            },
          },
        ]
      : [],
    ['catalog:claude'],
  )
  if (state === 'ready')
    return (
      <ComposerForm
        sessionId="catalog-recovery"
        harness={{ harness: 'claude' }}
        focusOnMount={focusOnReady}
        onFocusAfterMount={clearRecoveryFocus}
        turnConfigurationChoices={availableChoices}
        initialEditing={{ turnConfiguration: availableChoices.opening }}
      />
    )
  return (
    <div className="flex h-[320px] flex-col">
      <ComposerForm
        sessionId="catalog-recovery:loading"
        catalogFailure={state === 'failed' ? { reason: 'load-failed' } : null}
        loading
        harness={{ harness: 'claude' }}
        turnConfigurationChoices={state === 'failed' ? null : availableChoices}
        initialEditing={
          state === 'failed' ? undefined : { turnConfiguration: availableChoices.opening }
        }
      />
    </div>
  )
}

const meta = {
  title: 'Features/Sessions/Composer/Load Recovery',
  component: ComposerCatalogRecovery,
} satisfies Meta<typeof ComposerCatalogRecovery>

export default meta
type Story = StoryObj<typeof meta>

export const CatalogFailureRetriesIntoReadyComposer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    failCatalogRead()
    await expect(
      await page.findByText('Argo could not load Claude Code models. Try again.'),
    ).toBeVisible()
    await expect(canvas.queryByRole('alert')).toBeNull()
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    const message = await canvas.findByLabelText('Message')
    await expect(message).toHaveAttribute('aria-disabled', 'false')
    await waitFor(() => expect(message).toHaveFocus())
    await waitFor(() =>
      expect(page.queryByText('Argo could not load Claude Code models. Try again.')).toBeNull(),
    )
  },
}
