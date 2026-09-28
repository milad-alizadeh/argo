import type { Meta, StoryObj } from '@storybook/react-vite'
import { useCallback, useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { claudeComposerModelCatalogFixture } from '../../../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { claudeChoices } from '../../../../../test-fixtures/sessions/harness-catalog.fixture'
import { ComposerForm } from '../composer/layout/composer-form'
import type { TurnConfigurationChoices } from '../composer/turn-configuration/turn-configuration'
import { ComposerNotices } from './session-screen-details'

const choices = claudeChoices(claudeComposerModelCatalogFixture())
if (choices === null) throw new Error('The Claude story catalog has no usable model.')
const availableChoices = choices as TurnConfigurationChoices

function ComposerCatalogRecovery() {
  const [state, setState] = useState<'loading' | 'failed' | 'ready'>('loading')
  const [focusOnReady, setFocusOnReady] = useState(false)
  const clearRecoveryFocus = useCallback(() => setFocusOnReady(false), [])
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
      <button onClick={() => setState('failed')} type="button">
        Fail catalog read
      </button>
      <ComposerNotices
        catalogFailure={state === 'failed' ? { reason: 'load-failed' } : null}
        draft={null}
        harness={{ harness: 'claude' }}
        loading={state === 'loading'}
        onRetryCatalog={() => {
          setFocusOnReady(true)
          setState('ready')
        }}
        onRetryDraft={() => {}}
        permissionFailure={null}
      />
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
  title: 'Sessions/Composer/Load Recovery',
  component: ComposerCatalogRecovery,
} satisfies Meta<typeof ComposerCatalogRecovery>

export default meta
type Story = StoryObj<typeof meta>

export const CatalogFailureRetriesIntoReadyComposer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading the Composer…')
    await userEvent.click(canvas.getByRole('button', { name: 'Fail catalog read' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Argo could not load Claude Code models. Try again.',
    )
    const retry = canvas.getByRole('button', { name: 'Retry' })
    await expect(retry).toBeEnabled()
    await userEvent.tab()
    await expect(retry).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const message = await canvas.findByLabelText('Message')
    await expect(message).toHaveAttribute('aria-disabled', 'false')
    await waitFor(() => expect(message).toHaveFocus())
    await expect(
      canvas.queryByText('Argo could not load Claude Code models. Try again.'),
    ).toBeNull()
  },
}
