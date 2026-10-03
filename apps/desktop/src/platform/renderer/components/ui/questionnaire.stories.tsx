import type { Meta, StoryObj } from '@storybook/react-vite'
import type { FormEvent } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from './questionnaire'

const meta = {
  title: 'Design System/Primitives/Questionnaire',
  component: Questionnaire,
  args: { onSubmit: fn((event: FormEvent<HTMLFormElement>) => event.preventDefault()) },
} satisfies Meta<typeof Questionnaire>
export default meta
type Story = StoryObj<typeof meta>

export const RequiredAnswers: Story = {
  render: (args) => (
    <Questionnaire
      {...args}
      aria-label="Repository questions"
      items={[
        { name: 'language', required: true, choices: [{ value: 'typescript' }, { value: 'go' }] },
        { name: 'runner', required: true, choices: [{ value: 'bun' }, { value: 'vitest' }] },
      ]}
      shortcuts="letters"
    >
      <QuestionnaireProgress />
      <QuestionnaireItem multiple name="language" required>
        <QuestionnaireTitle>Language</QuestionnaireTitle>
        <QuestionnaireDescription>Choose the repository language.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="typescript">
            TypeScript
            <QuestionnaireChoiceDescription>Typed JavaScript.</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="go">Go</QuestionnaireChoice>
          <QuestionnaireInput aria-label="Other language" placeholder="Other language" />
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>
      <QuestionnaireItem name="runner" required>
        <QuestionnaireTitle>Runner</QuestionnaireTitle>
        <QuestionnaireDescription>Choose the test runner.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="bun">Bun</QuestionnaireChoice>
          <QuestionnaireChoice value="vitest">Vitest</QuestionnaireChoice>
        </QuestionnaireChoices>
        <QuestionnaireError />
      </QuestionnaireItem>
      <QuestionnaireActions>
        <QuestionnairePrevious />
        <QuestionnaireNext />
        <QuestionnaireSubmit />
      </QuestionnaireActions>
    </Questionnaire>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(canvas.getByRole('alert')).toHaveTextContent('Choose an answer to continue.')
    const language = canvas.getByRole('checkbox', { name: /TypeScript/ })
    await expect(language).toHaveFocus()
    await userEvent.keyboard('a')
    await expect(language).toBeChecked()
    await userEvent.keyboard('{Enter}')
    await expect(canvas.getByRole('group', { name: 'Runner' })).toBeVisible()
    await expect(canvas.getByRole('group', { name: 'Runner' })).toHaveFocus()
    await userEvent.click(canvas.getByRole('button', { name: 'Previous' }))
    await expect(canvas.getByRole('checkbox', { name: /TypeScript/ })).toBeChecked()
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await expect(canvas.getByRole('alert')).toHaveTextContent('Choose an answer to continue.')
    await userEvent.click(canvas.getByRole('radio', { name: 'Bun' }))
    await userEvent.keyboard('{Enter}')
    await expect(args.onSubmit).toHaveBeenCalledTimes(1)
  },
}
