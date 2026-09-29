import { expect, test } from 'bun:test'
import { claudeSkillDirectories } from './claude-skill-records'

function line(record: Record<string, unknown>): string {
  return JSON.stringify(record)
}

function metaRecord(parentUuid: string, folder: string, body = 'The whole SKILL.md body.'): string {
  return line({
    type: 'user',
    uuid: `${parentUuid}-meta`,
    parentUuid,
    isMeta: true,
    isSidechain: false,
    message: {
      role: 'user',
      content: [{ type: 'text', text: `Base directory for this skill: ${folder}\n\n${body}` }],
    },
  })
}

test('reads the folder a slash command recorded, under the record that invoked it', () => {
  const lines = [
    line({
      type: 'user',
      uuid: 'command-1',
      message: { role: 'user', content: '<command-name>/implement</command-name>' },
    }),
    metaRecord('command-1', '/repo/.claude/skills/implement'),
  ]

  expect([...claudeSkillDirectories(lines)]).toEqual([
    ['command-1', '/repo/.claude/skills/implement'],
  ])
})

test('reads the folder a Skill call recorded, under the call it answered as well', () => {
  const lines = [
    line({
      type: 'user',
      uuid: 'result-1',
      message: {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'Launching skill: prototype' },
        ],
      },
    }),
    metaRecord('result-1', '/repo/.claude/skills/prototype'),
  ]

  expect([...claudeSkillDirectories(lines)]).toEqual([
    ['result-1', '/repo/.claude/skills/prototype'],
    ['toolu_1', '/repo/.claude/skills/prototype'],
  ])
})

test('reads no folder from a record that only quotes the phrase', () => {
  const lines = [
    line({
      type: 'user',
      uuid: 'result-2',
      parentUuid: 'call-2',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_2',
            content: 'Base directory for this skill: /repo/.claude/skills/quoted',
          },
        ],
      },
    }),
    line({
      type: 'user',
      uuid: 'sidechain-1',
      parentUuid: 'call-3',
      isMeta: true,
      isSidechain: true,
      message: {
        role: 'user',
        content: [
          { type: 'text', text: 'Base directory for this skill: /repo/.claude/skills/aside' },
        ],
      },
    }),
  ]

  expect([...claudeSkillDirectories(lines)]).toEqual([])
})
