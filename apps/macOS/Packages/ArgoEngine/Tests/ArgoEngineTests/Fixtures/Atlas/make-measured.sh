#!/bin/sh
# Rebuilds `measured.bundle`, the fixture repository the Atlas generation suite measures (#1148).
#
# Committed beside the bundle rather than described in prose, because a fixture nobody can rebuild
# is a fixture nobody can extend. Every author, date and message is fixed here, so a rebuild
# produces the same commit SHAs — which is what lets a test assert the `commit` the Map records.
#
# The repository is built rather than trimmed from a real one for the one reason a real trim
# cannot serve: the awkward cases below have to all be present at once, and no real repository
# holds an empty file, an unterminated file, a binary and a deleted path in four adjacent commits.
#
# Run from anywhere: `sh make-measured.sh`. It writes `measured.bundle` beside itself.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# The machine's own git config is taken out of the way: `user.name`, `commit.gpgsign` and
# `diff.renames` would each otherwise change what this builds.
GIT_CONFIG_GLOBAL=/dev/null
GIT_CONFIG_SYSTEM=/dev/null
export GIT_CONFIG_GLOBAL GIT_CONFIG_SYSTEM

cd "$work"
git init --quiet -b main .

commit() {
  GIT_AUTHOR_NAME="$1" GIT_AUTHOR_EMAIL="$2" GIT_AUTHOR_DATE="$3" \
    GIT_COMMITTER_NAME="$1" GIT_COMMITTER_EMAIL="$2" GIT_COMMITTER_DATE="$3" \
    git commit --quiet -m "$4"
}

# One: the first files, by one author. `gone.txt` is here to be deleted in the next commit, so the
# history holds a path the working tree does not.
printf 'one\n' >README.md
mkdir -p src/app
printf 'let a = 1\nlet b = 2\nlet c = 3\n' >src/app/main.swift
mkdir -p notes/deep/one/two/three
printf 'leaf\n' >notes/deep/one/two/three/leaf.txt
printf '*.log\n' >.gitignore
printf 'temporary\n' >gone.txt
git add -A
commit 'Ada Lovelace' 'ada@example.com' '2026-01-05T09:00:00+0000' 'the first files'

# Two: a second author, and every file a measurer can trip over — a binary with a NUL byte in it,
# a file of no bytes at all, a file whose last line has no newline, a path with a space in it and
# a path outside ASCII.
printf 'one\ntwo\n' >README.md
printf 'let a = 1\nlet b = 2\nlet c = 3\nlet d = 4\n' >src/app/main.swift
mkdir -p assets
printf 'PNG\000\001\002binary\n' >assets/logo.bin
: >notes/empty.txt
printf 'no newline at the end' >notes/unterminated.txt
printf 'spaces\n' >'notes/a file with spaces.txt'
printf 'accents\n' >notes/café.txt
rm gone.txt
git add -A
commit 'Grace Hopper' 'grace@example.com' '2026-02-02T09:00:00+0000' 'the awkward files'

# Three: the first author again, on one file, so `main.swift` carries three commits and two
# authors while `README.md` carries two and two.
printf 'let a = 1\nlet b = 2\nlet c = 3\nlet d = 4\nlet e = 5\n' >src/app/main.swift
git add -A
commit 'Ada Lovelace' 'ada@example.com' '2026-03-02T09:00:00+0000' 'one more line'

git bundle create --quiet "$here/measured.bundle" --all
git log --format='%H %cI %an %s'
