#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the shell write-target reader, run via `bun run test:hooks`. It is the
// half of the worktree guardrail that reads a command line; worktree-guard.test.mjs covers
// what the guard then does with the paths. Soften one and the other together, never one alone.
import { check, report } from './check-harness.mjs'
import { writeTargets } from './shell-writes.mjs'

const targets = (command) => writeTargets(command)
const writes = (command, expected) => assert.deepEqual(targets(command), expected)

// Redirection — the form every one of the four uncommitted files arrived in (#1276).
check('reads a heredoc redirect', () =>
  writes("cat > scripts/hang-sample.sh <<'EOF'\n#!/bin/sh\nEOF", ['scripts/hang-sample.sh']),
)
check('reads an append redirect', () => writes('echo x >> package.json', ['package.json']))
check('reads a numbered redirect', () => writes('cmd 3> out.log', ['out.log']))
check('reads a redirect behind cd', () => writes('cd apps && echo x > apps/x.ts', ['apps/x.ts']))
check('does not read 2>&1 as a file', () => writes('swift build 2>&1 | tail -3', []))
check('does not read >&2 as a file', () => writes('echo boom >&2', []))

// Named writers.
check('reads tee', () => writes('echo x | tee scripts/y.sh', ['scripts/y.sh']))
check('reads sed -i, dropping the script', () =>
  writes("sed -i '' -e s/a/b/ package.json", ['package.json']),
)
check('ignores sed without -i', () => writes('sed -n 1,5p package.json', []))
check('reads the destination of cp, not the source', () =>
  writes('cp /tmp/x.sh scripts/x.sh', ['scripts/x.sh']),
)
check('reads mv', () => writes('mv /tmp/x.sh scripts/x.sh', ['scripts/x.sh']))
check('reads every positional of rm', () => writes('rm -f a.txt b.txt', ['a.txt', 'b.txt']))
check('reads dd of=', () => writes('dd if=/dev/zero of=scripts/x.sh', ['scripts/x.sh']))
check('reads apply_patch as the current directory', () =>
  writes("apply_patch <<'PATCH'\n*** Begin Patch\nPATCH", ['.']),
)

// Prefixes that are not the command.
check('sees past an env assignment', () => writes('FOO=1 tee package.json', ['package.json']))
check('sees past rtk', () => writes('rtk cp /tmp/a package.json', ['package.json']))
check('sees past sudo', () => writes('sudo touch package.json', ['package.json']))
check('does not mistake of= for an env prefix', () => writes('dd if=/dev/zero of=x.bin', ['x.bin']))

// Reads nothing.
check('reads nothing from a read-only command', () => writes('grep -r x apps/', []))
check('reads nothing from git worktree add', () =>
  writes('git worktree add -b argo/#1-x .claude/worktrees/ticket-1-x', []),
)
check('returns an unexpanded token as it is, for the caller to judge', () =>
  writes('echo x > "$TMPDIR/log"', ['$TMPDIR/log']),
)

report('shell-writes')
