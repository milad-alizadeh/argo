# Writing an exemption that actually ratchets

Reached from §5 of `SKILL.md`, on the **ratchet** branch — the repo has violations
that can't all be fixed now, so today's are recorded as scoped exemptions.

An exemption written wide is a permanent allowlist wearing a ratchet's label. These
are the four ways one comes out wider than intended, and where the reasons have to
live so the list keeps shrinking. **Every failure below has shipped.**

## Scope every exemption as narrowly as the tool allows

A path-only exemption silences the rule for the **whole file, forever** — including the
violation someone adds tomorrow. That defeats the ratchet: the list stops shrinking because
nothing forces it to. Where the tool can also match the message, symbol, or line
(`golangci-lint` `text:`, a baseline file keyed by finding, an ESLint block scoped to one
rule), use it — and where it can't, say so in the entry's reason.

- **Unanchored patterns match as substrings.** A linter's exclude-path list is usually
  regexes, not globs: `vendor` also exempts `internal/vendorportal/`. Anchor every one
  (`^vendor/`, `/testdata/`), and a bare-basename glob (`*.gen.ts`) matches at every depth —
  say so deliberately or qualify the path.
- **Message-scoped is not instance-scoped.** A `text:` regex that matches the *rule's*
  wording ("cognitive complexity of func") exempts every future violation of that rule in
  that file, which is the path-only exemption with extra steps. Anchor on the symbol —
  the function or identifier the debt actually lives in.
- **An expression is not a symbol either.** Anchoring on the offending *source line*
  (`source: json\.NewEncoder\(w\)\.Encode\(`) reads like a pin to one place and is really a
  pin to one *shape*: the next function in that file that writes the same line inherits the
  exemption, brand new and silent. If the tool matches only source text, choose a fragment
  that includes the symbol's own declaration — or accept it as blanket and label it so.
- **A count-based baseline ratchets count, not magnitude.** Baseline files that record "this
  file had 3 findings" let an exempted file grow without limit: a 200-line function becomes
  800 and the count is still 3. That is a real ratchet for *new files* and no ratchet at all
  for the listed ones — so where the tool works this way, **say so in the exemption file and
  in the note written in §6.4**. Otherwise the repo is told the list may only shrink, and
  that is false.
- **Category exclusions turn off more than the category.** "Skip files with a
  `Code generated … DO NOT EDIT` header" usually skips *every* rule, not just the line
  ceiling the house rule waives — and since the header is a line anyone can type, that is an
  unlabelled, self-service escape hatch outside the exemption files entirely. Name the rules
  a category exclusion turns off, and keep it to those.

  Where the tool offers a knob to turn that exclusion **off**, prove the knob **per rule,
  not in aggregate**. `golangci-lint`'s `exclusions.generated: disable` restores errcheck,
  funlen and dupl on a generated-header file while `revive` goes on skipping it under its own
  logic — so the parameter cap, the line ceiling and three more stay switchable by typing one
  comment, while the run reports enough other findings to look fixed. Two byte-identical
  files, one with the header and one without, is the check; whatever the header still
  suppresses is still an escape hatch.

**Then prove it, with a new and different violation.** Not a copy of the recorded one — a
*different* breach of the same rule, in an exempted file, and confirm the gate still fires.
A copy proves only that the tool matched the text you gave it. If the new one is silent, the
exemption is wider than the debt it was written for; narrow it, or record it honestly as the
blanket exemption it is.

## Reasons need somewhere to live

An exemption without its reason decays into a permanent allowlist. So the reason needs a
format that permits comments — prefer the `.jsonc` variant where the linter offers one, and
**verify it still lints after the edit**: Biome silently checks zero files when `biome.json`
contains a comment, rather than erroring.

Some tools have **no commentable format at all** — `jscpd`'s `.jscpd.json` is plain JSON, and
a comment there makes **auto-discovery** skip the entire config silently: no threshold, a
different file count, no error. For those: keep the config comment-free and put the reasons in
a sibling file that already holds them (the file-length exemption list is the natural home).

Then close the hole rather than documenting it. **Where naming the config explicitly makes the
tool parse instead of discover, wire that flag into the gate command** — `jscpd --config
.jscpd.json …` prints `config file .jscpd.json line 1: expected value` and exits non-zero on
the same malformed file that auto-discovery ignores. One flag converts a fail-open into a
fail-closed, which is worth more than any instruction telling a future reader to check.

And whatever you leave for that reader, **do not write a re-prove command whose polarity you
assumed**. Run it in both states — config healthy and config deliberately broken — and keep it
only if the two differ. `jscpd … -t 0` is the cautionary case, and it fails in both directions:
on a repo whose clones are all exempted it exits 0 healthy and 1 broken (the reader gets the
answer exactly backwards), and on a repo with any surviving duplication it exits 1 in *both*
states and distinguishes nothing. The signal that does discriminate is the **analysed file
count**, or a throwaway clone pair planted inside an ignored path and outside it. A detector
nobody ran in both states is not a detector.
