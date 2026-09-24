import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import type { ClaudeModelCatalog } from '@/harnesses/claude/catalog'
import type { CodexModelCatalog } from '@/harnesses/codex/catalog'
import {
  claudeChoices,
  codexChoices,
} from '../../../../../../test-fixtures/sessions/harness-catalog.fixture'
import type { SessionHarness } from '../../harness/harnesses'
import type { TurnSetup } from '../turn-setup/turn-setup'
import { RunSetupMenu } from './run-setup-menu'

// A started Session keeps its harness; a new one offers the harness tabs.
function RunSetupStory({ started = true }: { started?: boolean }) {
  const [harness, setHarness] = useState<SessionHarness>('claude')
  const initialChoices = claudeChoices(liveClaudeCatalog)
  if (initialChoices === null) throw new Error('The Claude story catalog has no usable model.')
  const [setup, setSetup] = useState(initialChoices.opening)
  const choices = harness === 'codex' ? codexChoices(liveCatalog) : initialChoices
  const chooseHarness = (nextHarness: SessionHarness) => {
    setHarness(nextHarness)
    const nextSetup =
      nextHarness === 'codex' ? codexChoices(liveCatalog) : claudeChoices(liveClaudeCatalog)
    if (nextSetup !== null) setSetup(nextSetup.opening)
  }
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <RunSetupMenu
        harness={started ? { harness } : { harness, onChange: chooseHarness }}
        setup={choices ? { choices, value: setup, onChange: setSetup } : null}
      />
    </div>
  )
}

function ClaudeCatalogStory({ failed = false }: { failed?: boolean }) {
  const [catalog, setCatalog] = useState<ClaudeModelCatalog | null>(null)
  const [catalogError, setCatalogError] = useState(failed)
  const choices = claudeChoices(catalog)
  const [setup, setSetup] = useState<TurnSetup | null>(null)
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <RunSetupMenu
        harness={{ harness: 'claude' }}
        setup={
          choices === null || setup === null ? null : { choices, value: setup, onChange: setSetup }
        }
        catalogError={catalogError}
        refreshCatalog={() => {
          setCatalog(liveClaudeCatalog)
          setSetup(claudeChoices(liveClaudeCatalog)?.opening ?? null)
          setCatalogError(false)
        }}
      />
    </div>
  )
}

const liveClaudeCatalog: ClaudeModelCatalog = {
  supportedPermissionModes: [
    'manual',
    'acceptEdits',
    'plan',
    'auto',
    'dontAsk',
    'bypassPermissions',
  ],
  data: [
    {
      value: 'fable',
      resolvedModel: 'claude-fable-5-1',
      displayName: 'Fable 5.1',
      description: 'Deepest reasoning for long, open-ended work',
      supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    },
    {
      value: 'opus',
      resolvedModel: 'claude-opus-5',
      displayName: 'Opus 5',
      description: 'Most capable for architecture and hard problems',
      supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    },
    {
      value: 'sonnet',
      resolvedModel: 'claude-sonnet-5',
      displayName: 'Sonnet 5',
      description: 'Balanced for daily coding and review',
      supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    },
    {
      value: 'haiku',
      resolvedModel: 'claude-haiku-4-5',
      displayName: 'Haiku 4.5',
      description: 'Fast for small changes and quick answers',
      supportedEffortLevels: ['low', 'medium'],
    },
  ],
}

const liveCatalog: CodexModelCatalog = {
  data: [
    {
      id: 'provider/live-codex',
      model: 'provider/live-codex',
      displayName: 'Live Codex Model',
      description: 'Current model reported by the running app-server',
      defaultReasoningEffort: 'focused',
      isDefault: true,
      hidden: false,
      supportedReasoningEfforts: [{ reasoningEffort: 'focused', description: 'Focused reasoning' }],
    },
  ],
  nextCursor: null,
}

function CodexCatalogStory({
  catalog: initialCatalog,
  failed = false,
}: {
  catalog: CodexModelCatalog | null
  failed?: boolean
}) {
  const [catalog, setCatalog] = useState(initialCatalog)
  const choices = codexChoices(catalog)
  const [setup, setSetup] = useState<TurnSetup | null>(choices?.opening ?? null)
  const [catalogError, setCatalogError] = useState(failed)
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <RunSetupMenu
        harness={{ harness: 'codex' }}
        setup={
          choices === null || setup === null ? null : { choices, value: setup, onChange: setSetup }
        }
        catalogError={catalogError}
        refreshCatalog={() => {
          setCatalog(liveCatalog)
          setSetup(codexChoices(liveCatalog)?.opening ?? null)
          setCatalogError(false)
        }}
      />
    </div>
  )
}

const meta = {
  title: 'Sessions/Composer/Run Setup Menu',
  component: RunSetupStory,
} satisfies Meta<typeof RunSetupStory>

export default meta
type Story = StoryObj<typeof RunSetupStory>

const page = () => within(document.body)

const TRIGGER = /^Choose run setup/

export const ChoosesModelAndEffort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await expect(trigger).toHaveTextContent('Opus 5·Medium')
    await expect(trigger).toHaveAccessibleName('Choose run setup: Claude Code, Opus 5, Medium')

    await userEvent.click(trigger)
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    const offered = within(models)
      .getAllByRole('radio')
      .map((option) => option.closest('label')?.textContent)
    await expect(offered).toEqual([
      'Fable 5.1Deepest reasoning for long, open-ended work',
      'Opus 5Most capable for architecture and hard problems',
      'Sonnet 5Balanced for daily coding and review',
      'Haiku 4.5Fast for small changes and quick answers',
    ])
    await userEvent.click(within(models).getByRole('radio', { name: /Sonnet 5/ }))
    await expect(within(models).getByRole('radio', { name: /Sonnet 5/ })).toBeChecked()

    const effort = page().getByRole('slider', { name: 'Effort' })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Medium')
    // user-event cannot step a native range, so the drag lands as the change it produces.
    fireEvent.change(effort, { target: { value: '4' } })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Max')
    fireEvent.change(effort, { target: { value: '3' } })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Extra high')
    const effortScale = effort.parentElement
    if (!effortScale) throw new Error('Effort scale is missing.')
    await expect(within(effortScale).getByText('Extra high')).toHaveClass('font-semibold')
    const harnesses = page().getByRole('tablist', { name: 'Harness' })
    for (const label of ['Claude Code', 'Codex']) {
      const tab = within(harnesses).getByRole('tab', { name: label })
      await expect(tab).toHaveAttribute('aria-disabled', 'true')
      await expect(tab).toHaveAttribute('tabindex', '-1')
    }

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Sonnet 5·Extra high')
  },
}

export const UsesLiveCodexCatalog: Story = {
  render: () => <CodexCatalogStory catalog={liveCatalog} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await expect(trigger).toHaveAccessibleName('Choose run setup: Codex, Live Codex Model, Focused')
    await userEvent.click(trigger)
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    await expect(within(models).getAllByRole('radio')).toHaveLength(1)
    await expect(within(models).getByRole('radio', { name: /Live Codex Model/ })).toBeChecked()
    await expect(page().getByRole('slider', { name: 'Effort' })).toHaveAttribute(
      'aria-valuetext',
      'Focused',
    )
    await expect(page().queryByRole('status')).toBeNull()
  },
}

export const UsesLiveClaudeCatalog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await expect(trigger).toHaveAccessibleName('Choose run setup: Claude Code, Opus 5, Medium')
    await userEvent.click(trigger)
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    await expect(within(models).getAllByRole('radio')).toHaveLength(4)
    await userEvent.click(within(models).getByRole('radio', { name: /Haiku 4.5/ }))
    await expect(page().getByRole('slider', { name: 'Effort' })).toHaveAttribute(
      'aria-valuetext',
      'Medium',
    )
    await expect(page().queryByRole('status')).toBeNull()
  },
}

export const LoadsClaudeCatalog: Story = {
  render: () => <ClaudeCatalogStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }))
    await expect(page().getByRole('status')).toHaveTextContent('Loading Claude Code models…')
    await expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull()
  },
}

export const RetriesClaudeCatalog: Story = {
  render: () => <ClaudeCatalogStory failed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }))
    await expect(page().getByRole('alert')).toHaveTextContent(
      'Argo could not load Claude Code models.',
    )
    await expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull()
    await expect(page().getByRole('button', { name: 'Refresh models' })).toBeEnabled()
    await userEvent.click(page().getByRole('button', { name: 'Refresh models' }))
    await expect(page().queryByRole('alert')).toBeNull()
    await expect(page().queryByRole('status')).toBeNull()
    await expect(
      within(page().getByRole('radiogroup', { name: 'Model' })).getAllByRole('radio'),
    ).toHaveLength(4)
  },
}

export const RetriesUnavailableCatalog: Story = {
  render: () => <CodexCatalogStory catalog={null} failed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await userEvent.click(trigger)
    await expect(page().getByRole('alert')).toHaveTextContent('Argo could not load Codex models.')
    await expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull()
    await userEvent.click(page().getByRole('button', { name: 'Refresh models' }))
    await expect(canvas.getByRole('button', { name: TRIGGER })).toHaveAccessibleName(
      'Choose run setup: Codex, Live Codex Model, Focused',
    )
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }))
    await expect(page().getByRole('radiogroup', { name: 'Model' })).toBeVisible()
    await expect(page().getByRole('radio', { name: /Live Codex Model/ })).toBeChecked()
  },
}

export const LoadsCatalog: Story = {
  render: () => <CodexCatalogStory catalog={null} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }))
    await expect(page().getByRole('status')).toHaveTextContent('Loading Codex models…')
  },
}

export const ChoosesByKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })

    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    await waitFor(() => expect(within(models).getByRole('radio', { name: /Opus 5/ })).toHaveFocus())

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    const haiku = within(models).getByRole('radio', { name: /Haiku 4.5/ })
    await expect(haiku).toHaveFocus()
    await expect(haiku).toBeChecked()
    await userEvent.tab()
    await expect(page().getByRole('slider', { name: 'Effort' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}

export const NewSessionChoosesHarness: Story = {
  args: { started: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })

    await userEvent.click(trigger)
    const harnesses = await page().findByRole('tablist', { name: 'Harness' })
    const claude = within(harnesses).getByRole('tab', { name: 'Claude Code' })
    await waitFor(() => expect(claude).toHaveFocus())
    await expect(claude).toHaveAttribute('aria-selected', 'true')
    // The track pads the active tab on every side (602bcce2); the popover may still be scaling in.
    await expect(harnesses.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(
      claude.getBoundingClientRect().bottom + 3,
    )
    await expect(page().getByRole('tabpanel')).toContainElement(
      page().getByRole('radiogroup', { name: 'Model' }),
    )
    // The panel is no Tab stop of its own: Tab goes from the tab straight to the chosen Model.
    await userEvent.tab()
    await expect(page().getByRole('radio', { name: /Opus 5/ })).toHaveFocus()
    await userEvent.tab({ shift: true })
    await expect(claude).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}{Enter}')
    const codex = within(harnesses).getByRole('tab', { name: 'Codex' })
    await expect(codex).toHaveAttribute('aria-selected', 'true')
    const codexModels = page().getByRole('radiogroup', { name: 'Model' })
    await expect(within(codexModels).getAllByRole('radio')).toHaveLength(1)
    await expect(within(codexModels).getByRole('radio', { name: /Live Codex Model/ })).toBeChecked()
    await expect(trigger).toHaveAccessibleName('Choose run setup: Codex, Live Codex Model, Focused')

    await userEvent.click(within(harnesses).getByRole('tab', { name: 'Claude Code' }))
    await expect(page().getByRole('radiogroup', { name: 'Model' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('tablist')).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Opus 5·Medium')
  },
}
