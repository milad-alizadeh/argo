# The Atlas generation fixtures

`measured.bundle` is the repository the generation suite measures (#1148). A `git bundle` rather
than a checked-in tree, because a `.git` directory cannot be committed inside another repository
and because a bundle carries the history whole: the same commit SHAs, authors and dates on every
machine, which is what lets a test assert the `commit` the Map records.

`make-measured.sh` builds it. Run `sh make-measured.sh` to rebuild the bundle in place; it takes
the machine's own git config out of the way first, so `user.name`, `commit.gpgsign` and
`diff.renames` cannot change what comes out.

## What it carries

Three commits by two authors, over three months of 2026, chosen so a measure with an awkward
value exists for every branch the generator has:

| path | why it is there |
| --- | --- |
| `src/app/main.swift` | touched by all three commits — three commits, two authors |
| `README.md` | touched by two of the three — two commits, two authors |
| `notes/deep/one/two/three/leaf.txt` | five levels down, and touched once |
| `assets/logo.bin` | holds a NUL byte, so it is binary and has no lines to count |
| `notes/empty.txt` | no bytes at all, which is the zero a band on a log scale divides by |
| `notes/unterminated.txt` | one line and no newline ending it |
| `notes/a file with spaces.txt` | a path git quotes unless it is asked for NUL-separated output |
| `notes/café.txt` | the same, outside ASCII |
| `gone.txt` | committed then deleted — in the history, not in the working tree |
| `.gitignore` | ignores `*.log`, so the suite can drop a file the map must not carry |

It has no `CONTEXT.md`, no `AGENTS.md`, no `docs/adr/` and no `rules/`, which is the point: the
map exists for any registered git repository with no prior setup (#655), so a fixture that had
Argo's own furniture in it could not show that.

One case a bundle cannot carry is a repository with no commits, because there is nothing to
bundle. `AtlasRepositoryFixture` makes that one with `git init`.
