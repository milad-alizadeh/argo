import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'
import type { Harness } from '@/harnesses/harness'
import type { AvailableHarness, CatalogReadResult } from '@/harnesses/harness-catalog'
import {
  claudeHarnessInfoFixture,
  codexHarnessInfoFixture,
} from '@/mocks/sessions/harness-catalog.fixture'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'
import { EffortSlider } from './effort-slider'
import { type CatalogFailure, TurnConfigurationMenu } from './turn-configuration-menu'

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
      value: 'gpt-5.6-terra',
      label: 'GPT-5.6-Terra',
      detail: 'Older balanced model for straightforward work.',
      defaultEffort: 'medium',
      efforts: ['medium'],
      readings: { exact: ['gpt-5.6-terra'], prefixes: [] },
    },
  ],
  efforts: [
    {
      value: 'medium',
      label: 'Balances speed and reasoning',
      readings: { exact: ['medium'], prefixes: [] },
    },
  ],
  opening: { model: 'gpt-5.6-terra', effort: 'medium', mode: 'workspace-write' },
}
const readyClaude: CatalogReadResult = { info: liveClaudeInfo, failure: null }
const readyCodex: CatalogReadResult = { info: liveCodexInfo, failure: null }
type UnavailableReason = Extract<CatalogFailure['reason'], 'invalid-response' | 'unavailable'>
function unavailableResult(harness: Harness, reason: UnavailableReason): CatalogReadResult {
  return { info: { harness, availability: 'unavailable', reason }, failure: null }
}

function availableInfo(result: CatalogReadResult | null): AvailableHarness | null {
  return result?.info.availability === 'available' ? result.info : null
}
function failureOf(result: CatalogReadResult | null): CatalogFailure | null {
  if (result?.failure) return { reason: 'load-failed' }
  return result?.info.availability === 'unavailable' ? { reason: result.info.reason } : null
}

// A started Session keeps its harness; a new one offers the harness tabs.
function TurnConfigurationStory({
  started = true,
  narrow = false,
}: {
  started?: boolean
  narrow?: boolean
}) {
  const [harness, setHarness] = useState<Harness>('claude')
  const [turnConfiguration, setTurnConfiguration] = useState(liveClaudeInfo.opening)
  const result = harness === 'codex' ? readyCodex : readyClaude
  const choices = availableInfo(result)
  const chooseHarness = (nextHarness: Harness) => {
    setHarness(nextHarness)
    setTurnConfiguration(nextHarness === 'codex' ? liveCodexInfo.opening : liveClaudeInfo.opening)
  }
  return (
    <div className={`@container flex min-h-dvh items-end p-8 ${narrow ? 'w-72' : 'max-w-4xl'}`}>
      <TurnConfigurationMenu
        harness={started ? { harness } : { harness, onChange: chooseHarness }}
        turnConfiguration={
          choices ? { choices, value: turnConfiguration, onChange: setTurnConfiguration } : null
        }
      />
    </div>
  )
}

function CatalogStory({
  harness,
  failure,
  initialReady = false,
}: {
  harness: Harness
  failure?: UnavailableReason
  initialReady?: boolean
}) {
  const ready = harness === 'codex' ? readyCodex : readyClaude
  let initialResult: CatalogReadResult | null = null
  if (initialReady) initialResult = ready
  else if (failure) initialResult = unavailableResult(harness, failure)
  const [result, setResult] = useState<CatalogReadResult | null>(initialResult)
  const [turnConfiguration, setTurnConfiguration] = useState<TurnConfiguration | null>(
    initialReady ? (availableInfo(ready)?.opening ?? null) : null,
  )
  const choices = availableInfo(result)
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <TurnConfigurationMenu
        harness={{ harness }}
        turnConfiguration={
          choices && turnConfiguration
            ? { choices, value: turnConfiguration, onChange: setTurnConfiguration }
            : null
        }
        catalogFailure={failureOf(result)}
        refreshCatalog={() => {
          setResult(ready)
          setTurnConfiguration(availableInfo(ready)?.opening ?? null)
        }}
      />
    </div>
  )
}

function EffortFallbackStory() {
  const [value, setValue] = useState<TurnConfiguration>({
    model: 'haiku',
    effort: 'high',
    mode: 'manual',
  })
  return (
    <div className="max-w-lg">
      <EffortSlider choices={liveClaudeInfo} value={value} onChange={setValue} />
    </div>
  )
}

const meta = {
  title: 'Features/Sessions/Composer/Turn Configuration Menu',
  component: TurnConfigurationStory,
} satisfies Meta<typeof TurnConfigurationStory>

export default meta
type Story = StoryObj<typeof TurnConfigurationStory>

const page = () => within(document.body)

const TRIGGER = /^Choose Turn configuration/

async function clickSliderTrackAt(root: ParentNode, fraction: number) {
  const track = root.querySelector<HTMLElement>('[data-slot="slider-track"]')
  if (!track) throw new Error('Effort slider track is missing')
  const bounds = track.getBoundingClientRect()
  await userEvent.pointer({
    keys: '[MouseLeft]',
    target: track,
    coords: {
      clientX: bounds.left + bounds.width * fraction,
      clientY: bounds.top + bounds.height / 2,
    },
  })
}

async function expectRoleHidden(role: string, name: string) {
  await waitFor(() => {
    const element = page().queryByRole(role as never, { name })
    if (element === null) return
    expect(element).not.toBeVisible()
  })
}

export const ChoosesModelAndEffort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await expect(trigger).toHaveTextContent('Opus 5·Medium')
    await expect(trigger).toHaveAccessibleName(
      'Choose Turn configuration: Claude Code, Opus 5, Medium',
    )

    await userEvent.click(trigger)
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    await expectModelNamesAndDetails(models, canvasElement.ownerDocument)
    await expect(
      within(models).getByRole('radio', { name: 'Sonnet 5' }),
    ).toHaveAccessibleDescription('Balanced for daily coding and review')
    const sonnet = within(models).getByRole('radio', { name: 'Sonnet 5' })
    const sonnetRowLabel = sonnet.parentElement?.querySelector<HTMLLabelElement>('label')
    if (!sonnetRowLabel) throw new Error('Sonnet choice label is missing')
    await clickRowPadding(sonnetRowLabel)
    await expect(sonnet).toBeChecked()

    const effort = page().getByRole('slider', { name: /^Effort/ })
    await expect(effort).toHaveAccessibleName('Effort Medium')
    await expect(effort).toHaveAttribute('aria-valuetext', 'Medium')
    await expect(effort).toHaveAccessibleDescription(
      'More effort trades speed for deeper reasoning.',
    )
    await clickSliderTrackAt(document.body, 0.95)
    await expect(effort).toHaveAccessibleName('Effort Max')
    await expect(effort).toHaveAttribute('aria-valuetext', 'Max')
    await expect(effort).toHaveAttribute('aria-valuenow', '4')
    fireEvent.change(effort, { target: { value: '3' } })
    await expect(effort).toHaveAccessibleName('Effort Extra high')
    await expect(effort).toHaveAttribute('aria-valuetext', 'Extra high')
    await expect(effort).toHaveAttribute('aria-valuenow', '3')
    const harnesses = page().getByRole('tablist', { name: 'Harness' })
    for (const label of ['Claude Code', 'Codex']) {
      const tab = within(harnesses).getByRole('tab', { name: label })
      await expect(tab).toHaveAttribute('aria-disabled', 'true')
      await expect(tab).toHaveAttribute('tabindex', '-1')
    }

    await userEvent.keyboard('{Escape}')
    await expectRoleHidden('radiogroup', 'Model')
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Sonnet 5·Extra high')
  },
}

async function clickRowPadding(label: HTMLLabelElement) {
  const bounds = label.getBoundingClientRect()
  await userEvent.pointer({
    keys: '[MouseLeft]',
    target: label,
    coords: { clientX: bounds.left + 4, clientY: bounds.top + bounds.height / 2 },
  })
}

async function expectModelNamesAndDetails(models: HTMLElement, ownerDocument: Document) {
  const modelOptions = within(models).getAllByRole('radio')
  const referencedText = (
    option: HTMLElement,
    attribute: 'aria-labelledby' | 'aria-describedby',
  ) => {
    const id = option.getAttribute(attribute)
    return id ? ownerDocument.getElementById(id)?.textContent : null
  }
  await expect(modelOptions.map((option) => referencedText(option, 'aria-labelledby'))).toEqual([
    'Fable 5.1',
    'Opus 5',
    'Sonnet 5',
    'Haiku 4.5',
  ])
  await expect(modelOptions.map((option) => referencedText(option, 'aria-describedby'))).toEqual([
    'Deepest reasoning for long, open-ended work',
    'Most capable for architecture and hard problems',
    'Balanced for daily coding and review',
    'Fast for small changes and quick answers',
  ])
}

export const UsesLiveCodexCatalog: Story = {
  render: () => <CatalogStory harness="codex" initialReady />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await expect(trigger).toHaveTextContent('GPT-5.6-Terra·Balances speed and reasoning')
    await expect(trigger).toHaveAccessibleName(
      'Choose Turn configuration: Codex, GPT-5.6-Terra, Balances speed and reasoning',
    )
    await userEvent.click(trigger)
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    await expect(within(models).getAllByRole('radio')).toHaveLength(1)
    await expect(within(models).getByRole('radio', { name: /GPT-5.6-Terra/ })).toBeChecked()
    const effort = page().getByRole('slider', { name: /^Effort/ })
    await expect(effort).toHaveAccessibleName('Effort Balances speed and reasoning')
    await expect(effort).toHaveAttribute('aria-valuetext', 'Balances speed and reasoning')
    await expect(effort).toBeDisabled()
    await expect(page().queryByRole('status')).toBeNull()
  },
}

export const UsesLiveClaudeCatalog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await expect(trigger).toHaveAccessibleName(
      'Choose Turn configuration: Claude Code, Opus 5, Medium',
    )
    await userEvent.click(trigger)
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    await expect(within(models).getAllByRole('radio')).toHaveLength(4)
    await userEvent.click(within(models).getByRole('radio', { name: /Haiku 4.5/ }))
    await expect(page().getByRole('slider', { name: /^Effort/ })).toHaveAccessibleName(
      'Effort Medium',
    )
    await expect(page().getByRole('slider', { name: /^Effort/ })).toHaveAttribute(
      'aria-valuetext',
      'Medium',
    )
    await expect(page().queryByRole('status')).toBeNull()
  },
}

export const FallsBackToFirstOfferedEffort: Story = {
  render: () => <EffortFallbackStory />,
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole('slider', { name: 'Effort Low' })
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    await expect(slider).toHaveAttribute('aria-valuetext', 'Low')
    await expect(slider).toHaveAccessibleDescription(
      'More effort trades speed for deeper reasoning.',
    )
    slider.focus()
    await userEvent.keyboard('{End}')
    await expect(slider).toHaveAttribute('aria-valuenow', '1')
    await expect(slider).toHaveAttribute('aria-valuetext', 'Medium')
    await expect(slider).toHaveAccessibleName('Effort Medium')
  },
}

export const LoadsClaudeCatalog: Story = {
  render: () => <CatalogStory harness="claude" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }))
    await expect(page().getByRole('status')).toHaveTextContent('Loading Claude Code models…')
    await expectRoleHidden('radiogroup', 'Model')
  },
}

export const RetriesClaudeCatalog: Story = {
  render: () => <CatalogStory harness="claude" failure="invalid-response" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }))
    await expect(page().getByRole('alert')).toHaveTextContent(
      'Claude Code returned model data that Argo cannot read.',
    )
    await expectRoleHidden('radiogroup', 'Model')
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
  render: () => <CatalogStory harness="codex" failure="unavailable" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    // A failure with no named reason is read again when the menu opens.
    await userEvent.click(trigger)
    await waitFor(() => expect(page().getByRole('radiogroup', { name: 'Model' })).toBeVisible())
    await expect(page().getByRole('radio', { name: /GPT-5.6-Terra/ })).toBeChecked()
  },
}

export const NamesMissingAgentInstallStep: Story = {
  render: () => (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <TurnConfigurationMenu
        harness={{ harness: 'claude-acp' }}
        turnConfiguration={null}
        catalogFailure={{
          reason: 'not-installed',
          installStep: 'Install it, then refresh models.',
        }}
        refreshCatalog={() => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: TRIGGER }))
    const alert = page().getByRole('alert')
    await expect(alert).toHaveTextContent('Claude ACP is not installed.')
    await expect(alert).toHaveTextContent('Install it, then refresh models.')
    await expect(page().getByRole('button', { name: 'Refresh models' })).toBeEnabled()
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
    await expect(page().getByRole('slider', { name: /^Effort/ })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await expectRoleHidden('radiogroup', 'Model')
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
    await expect(within(codexModels).getByRole('radio', { name: /GPT-5.6-Terra/ })).toBeChecked()
    await expect(trigger).toHaveAccessibleName(
      'Choose Turn configuration: Codex, GPT-5.6-Terra, Balances speed and reasoning',
    )

    await userEvent.click(within(harnesses).getByRole('tab', { name: 'Claude Code' }))
    await expect(page().getByRole('radiogroup', { name: 'Model' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expectRoleHidden('tablist', 'Harness')
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Opus 5·Medium')
  },
}

export const NarrowModelDetails: Story = {
  args: { narrow: true },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: TRIGGER })
    await userEvent.click(trigger)
    const model = await page().findByRole('radio', { name: 'Fable 5.1' })
    await expect(model).toHaveAccessibleDescription('Deepest reasoning for long, open-ended work')
    await userEvent.click(model)
    await expect(model).toBeChecked()
    await userEvent.tab()
    const effort = page().getByRole('slider', { name: /^Effort/ })
    await expect(effort).toHaveFocus()
    fireEvent.change(effort, { target: { value: '2' } })
    await expect(effort).toHaveAccessibleName('Effort High')
    await expect(effort).toHaveAttribute('aria-valuenow', '2')
    await expect(effort).toHaveAttribute('aria-valuetext', 'High')
    await userEvent.keyboard('{Escape}')
    await expectRoleHidden('radiogroup', 'Model')
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Fable 5.1')
    await expect(trigger).toHaveTextContent('High')
  },
}
