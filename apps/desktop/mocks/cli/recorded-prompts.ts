// The prompts `bun run record:vendor-history` sends; a test finds a recorded Session by its prompt.
export const RECORDED_PROMPTS = {
  claudeProse: 'Say hello, then confirm.',
  claudeThought: 'Ultrathink: is 221 prime? Reason before answering, then answer in one sentence.',
  claudeToolCalls:
    'Run the composer check: run the shell command echo argo-recorded with the Bash tool, then edit notes.txt to replace old with new. Reply with one short sentence.',
  claudeParent: 'Start the parent work: reply with one short sentence.',
  claudeContinue: 'Continue the work: reply with one short sentence.',
  claudeBranch: 'Branch off: reply with one short sentence.',
  codexCommand: 'Run Codex check',
  codexReply: 'Continue the check',
  codexSubagent:
    'Spawn exactly one native subagent to list the files in this empty project. Do not do the task yourself. Wait for the subagent to finish, then reply with its list.',
  codexNotice:
    '<task-notification><task-id>corpus-task</task-id><status>completed</status><summary>Task finished</summary></task-notification>',
} as const
