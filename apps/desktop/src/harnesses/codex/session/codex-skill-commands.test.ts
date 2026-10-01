import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import { MOCK_CODEX_SKILLS_FILE_ENV } from '@/mocks/cli/codex/fixtures/mock-codex-skills-config'
import { clientBackedByMock, waitFor, writeMockCodex } from '@/mocks/cli/codex/mock-codex-driver'
import { openLiveSession } from '@/mocks/cli/codex/mock-codex-live-session'
import { createCodexRegistration } from '../registration'

type Listed = Extract<LiveSessionChannelEvent, { type: 'commands' }>

async function recordedSkills(): Promise<Record<string, unknown>[]> {
  const recorded = JSON.parse(
    await readFile(
      path.join(process.cwd(), 'mocks/cli/codex/fixtures/skills-list-codex-0.157.0.json'),
      'utf8',
    ),
  )
  return recorded.data[0].skills
}

async function codexServingSkills(skills: unknown[]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-skills-'))
  const skillsFile = path.join(root, 'skills.json')
  await writeFile(skillsFile, JSON.stringify(skills))
  const client = clientBackedByMock(
    await writeMockCodex(root, { [MOCK_CODEX_SKILLS_FILE_ENV]: skillsFile }),
  )
  return {
    client,
    skillsFile,
    async stop() {
      client.shutdown()
      await rm(root, { recursive: true, force: true })
    },
  }
}

test('lists the skills Codex reports, in the fields every Harness shows', async () => {
  const codex = await codexServingSkills(await recordedSkills())
  try {
    const listing = await createCodexRegistration(codex.client).listCommands?.({ cwd: '/repo' })
    assert.deepEqual(
      listing?.commands.map(({ name, argumentHint, aliases }) => ({ name, argumentHint, aliases })),
      [
        { name: 'ask-matt', argumentHint: '', aliases: [] },
        { name: 'brandkit', argumentHint: '', aliases: [] },
        { name: 'imagegen', argumentHint: '', aliases: [] },
        { name: 'pdf:pdf', argumentHint: '', aliases: [] },
      ],
    )
    assert.equal(
      listing?.commands[0]?.description,
      'Ask which skill or flow fits your situation. A router over the skills in this repo.',
    )
  } finally {
    await codex.stop()
  }
})

test('leaves out a disabled skill and counts a skill shape it cannot read', async () => {
  const [skill] = await recordedSkills()
  const codex = await codexServingSkills([
    skill,
    { ...skill, name: 'switched-off', enabled: false },
    { ...skill, name: 7 },
  ])
  const warnings: unknown[][] = []
  const warn = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    const listing = await createCodexRegistration(codex.client).listCommands?.({ cwd: '/repo' })
    assert.deepEqual(
      listing?.commands.map(({ name }) => name),
      ['ask-matt'],
    )
    assert.deepEqual(warnings, [['Rejected 1 unsupported Codex skill shape(s).']])
  } finally {
    console.warn = warn
    await codex.stop()
  }
})

test('a live Session lists its skills, then lists them again when Codex says they changed', async () => {
  const [skill] = await recordedSkills()
  const codex = await codexServingSkills([skill])
  const session = openLiveSession(codex.client)
  const listed = () =>
    session.events.flatMap((event): Listed[] => (event.type === 'commands' ? [event] : []))
  try {
    await waitFor(() => listed().length === 1, 'the first skill list')
    assert.deepEqual(
      listed()[0]?.commands.map(({ name }) => name),
      ['ask-matt'],
    )
    await writeFile(codex.skillsFile, JSON.stringify([skill, { ...skill, name: 'review' }]))
    await waitFor(
      () => listed().at(-1)?.commands.length === 2,
      'the skill list after skills/changed',
    )
    assert.deepEqual(
      listed()
        .at(-1)
        ?.commands.map(({ name }) => name),
      ['ask-matt', 'review'],
    )
  } finally {
    session.channel.close()
    await codex.stop()
  }
})
