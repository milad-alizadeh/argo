import { expect, test } from 'bun:test'
import { codexShellCommand } from './codex-shell-words'

// The first three are what `thread/read` returned for the same rollout argument list.
test.each([
  [['/bin/zsh', '-lc', 'rtk cat SKILL.md'], "/bin/zsh -lc 'rtk cat SKILL.md'"],
  [['/bin/zsh', '-lc', "rg -n 'watch|tail' src"], `/bin/zsh -lc "rg -n 'watch|tail' src"`],
  [
    ['/bin/zsh', '-lc', "rg -n '^#{1,4} |observer' spec.md"],
    `/bin/zsh -lc "rg -n '"'^#{1,4} |observer'"' spec.md"`,
  ],
  [['/bin/zsh', '-lc', 'echo "$HOME" \\ done'], `/bin/zsh -lc 'echo "$HOME" '"\\\\ done"`],
  [['ls', ''], "ls ''"],
  [['echo', 'café'], "echo 'café'"],
])('joins %j as thread/read writes it', (words, command) => {
  expect(codexShellCommand(words)).toBe(command)
})
