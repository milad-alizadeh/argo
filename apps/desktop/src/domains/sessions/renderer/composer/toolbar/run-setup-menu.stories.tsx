import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import type { CatalogReadResult } from '@/harnesses/catalog/catalog-read'
import type { AvailableHarness } from '@/harnesses/catalog/harness-catalog-machine'
import {
  claudeHarnessInfoFixture,
  codexHarnessInfoFixture,
} from '../../../../../../test-fixtures/sessions/harness-catalog.fixture'
import type { SessionHarness } from '../../harness/harnesses'
import type { TurnSetup } from '../turn-setup/turn-setup'
import { type CatalogFailure, RunSetupMenu } from './run-setup-menu'

const claudeFixture = claudeHarnessInfoFixture()
const liveClaudeInfo: AvailableHarness = {
  ...claudeFixture,
  models: (
    [
      ['fable', 'Fable 5.1', 'Deepest reasoning for long, open-ended work'],
      ['opus', 'Opus 5', 'Most capable for architecture and hard problems'],
      ['sonnet', 'Sonnet 5', 'Balanced for daily coding and review'],
      ['haiku', 'Haiku 4.5', 'Fast for small changes and quick answers'],
    ] as const
  ).map(([value, label, detail]) => ({
    value,
    label,
    detail,
    defaultEffort: 'medium',
    efforts: value === 'haiku' ? ['low', 'medium'] : ['low', 'medium', 'high', 'xhigh', 'max'],
    supportedModes: claudeFixture.modes.map((mode) => mode.value),
    readings: { exact: [value], prefixes: [] },
  })),
  opening: { model: 'opus', effort: 'medium', mode: 'manual' },
}
const codexFixture = codexHarnessInfoFixture()
const liveCodexInfo: AvailableHarness = {
  ...codexFixture,
  models: [
    {
      value: 'provider/live-codex',
      label: 'Live Codex Model',
      detail: 'Current model reported by the running app-server',
      defaultEffort: 'focused',
      efforts: ['focused'],
      readings: { exact: ['provider/live-codex'], prefixes: [] },
    },
  ],
  efforts: [{ value: 'focused', label: 'Focused', readings: { exact: ['focused'], prefixes: [] } }],
  opening: { model: 'provider/live-codex', effort: 'focused', mode: 'workspace-write' },
}
const readyClaude: CatalogReadResult = { info: liveClaudeInfo, failure: null }
const readyCodex: CatalogReadResult = { info: liveCodexInfo, failure: null }
const unavailableClaude: CatalogReadResult = {
  info: { harness: 'claude', availability: 'unavailable', reason: 'invalid-response' },
  failure: null,
}
const unavailableCodex: CatalogReadResult = {
  info: { harness: 'codex', availability: 'unavailable', reason: 'unavailable' },
  failure: null,
}

function availableInfo(result: CatalogReadResult | null): AvailableHarness | null {
  return result?.info.availability === 'available' ? result.info : null
}
function failureOf(result: CatalogReadResult | null): CatalogFailure | null {
  if (result?.failure) return { reason: 'load-failed' }
  return result?.info.availability === 'unavailable' ? { reason: result.info.reason } : null
}

// A started Session keeps its harness; a new one offers the harness tabs.
function RunSetupStory({ started = true }: { started?: boolean }) {
  const [harness, setHarness] = useState<SessionHarness>('claude')
  const [setup, setSetup] = useState(liveClaudeInfo.opening)
  const result = harness === 'codex' ? readyCodex : readyClaude
  const choices = availableInfo(result)
  const chooseHarness = (nextHarness: SessionHarness) => {
    setHarness(nextHarness)
    setSetup(nextHarness === 'codex' ? liveCodexInfo.opening : liveClaudeInfo.opening)
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

function CatalogStory({
  harness,
  failed = false,
  initialReady = false,
}: {
  harness: SessionHarness
  failed?: boolean
  initialReady?: boolean
}) {
  const ready = harness === 'codex' ? readyCodex : readyClaude
  const unavailable = harness === 'codex' ? unavailableCodex : unavailableClaude
  let initialResult: CatalogReadResult | null = null
  if (initialReady) initialResult = ready
  else if (failed) initialResult = unavailable
  const [result, setResult] = useState<CatalogReadResult | null>(initialResult)
  const [setup, setSetup] = useState<TurnSetup | null>(
    initialReady ? (availableInfo(ready)?.opening ?? null) : null,
  )
  const choices = availableInfo(result)
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <RunSetupMenu
        harness={{ harness }}
        setup={choices && setup ? { choices, value: setup, onChange: setSetup } : null}
        catalogFailure={failureOf(result)}
        refreshCatalog={() => {
          setResult(ready)
          setSetup(availableInfo(ready)?.opening ?? null)
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
  render: () => <CatalogStory harness="codex" initialReady />,
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
  render: () => <CatalogStory harness="claude" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }))
    await expect(page().getByRole('status')).toHaveTextContent('Loading Claude Code models…')
    await expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull()
  },
}

export const RetriesClaudeCatalog: Story = {
  render: () => <CatalogStory harness="claude" failed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }))
    await expect(page().getByRole('alert')).toHaveTextContent(
      'Claude Code returned model data that Argo cannot read.',
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
  render: () => <CatalogStory harness="codex" failed />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await userEvent.click(trigger)
    await expect(page().getByRole('alert')).toHaveTextContent('Codex is unavailable. Try again.')
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
  render: () => <CatalogStory harness="codex" />,
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
