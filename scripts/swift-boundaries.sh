#!/bin/sh
# Module boundaries for apps/macOS — the Swift counterpart of dependency-cruiser, which
# cannot see Swift. Scans the whole tree and ignores any arguments, so lint-staged may
# append staged paths without changing what is checked: a boundary is a property of the
# tree, not of the file you happened to touch.
#
# Edges 1-4 are ADR-0022's layering; edge 5 is ADR-0027, on the projection between two of its
# layers; edge 6 is the parameter cap on the one declaration shape SwiftLint cannot see. Each is
# checkable by looking at imports, declarations and size alone — which is the whole reason they are
# gates rather than review notes.
set -eu

APP_DIR="apps/macOS"
UI_SOURCES="$APP_DIR/Packages/ArgoUI/Sources"
ENGINE_SOURCES="$APP_DIR/Packages/ArgoEngine/Sources/ArgoEngine"
APP_TARGET="$APP_DIR/Argo"
# The one file in ArgoUI allowed to read live Hub state: the Hub → cockpit projection.
PROJECTION_FILE="CockpitPresentation+Hub.swift"
PROJECTION="$UI_SOURCES/ArgoUI/Shell/$PROJECTION_FILE"
# The value the projection assembles. Its init body is the second place a fact can land on the
# wrong slot, and the edge below reads both files for that reason.
PROJECTED_FILE="CockpitPresentation+Session.swift"
PROJECTED="$UI_SOURCES/ArgoUI/Shell/$PROJECTED_FILE"
# The grouped values the projected init takes, one per reading. A group whose OWN init unpacks
# facts onto slots is a third hand, and a fact dropped on the wrong slot there reaches the two
# files above already swapped — so this one is read for the slot check too (#1051).
VALUES_FILE="CockpitPresentation+SessionValues.swift"
VALUES="$UI_SOURCES/ArgoUI/Shell/$VALUES_FILE"
HUB_SESSION="$ENGINE_SOURCES/Hub/HubSession.swift"
SWIFTLINT_CONFIG="$APP_DIR/.swiftlint.yml"

if [ ! -d "$APP_DIR" ]; then
  echo "swift-boundaries: $APP_DIR not found — run from the repo root" >&2
  exit 1
fi

# Everything below reads Swift as TEXT, so both edges that do arithmetic on it share one reader.
# `code` is the line with its comments and string CONTENTS removed: a `//` inside a string ends no
# comment, and a `"` inside one opens no string. Getting that wrong silently unbalances the parens
# for the rest of the file, which is a gate that passes everything and says so — the exact
# fail-open docs/agents/quality-gates.md is about. `""" `blocks are tracked across lines because
# their contents are prose that may hold anything.
AWK_READER='
  function code(line,   out, i, char, next2) {
    out = ""
    if (inblock) {
      i = index(line, "\"\"\"")
      if (!i) return ""
      inblock = 0
      line = substr(line, i + 3)
    }
    for (i = 1; i <= length(line); i++) {
      char = substr(line, i, 1)
      next2 = substr(line, i, 3)
      if (next2 == "\"\"\"") { inblock = 1; return out }
      if (char == "/" && substr(line, i, 2) == "//") return out
      if (char == "\"") {
        for (i++; i <= length(line); i++) {
          if (substr(line, i, 1) == "\\") { i++; continue }
          if (substr(line, i, 1) == "\"") break
        }
        continue
      }
      out = out char
    }
    return out
  }
'

failed=0

report() {
  failed=1
  echo "" >&2
  echo "swift-boundaries: $1" >&2
  shift
  printf '%s\n' "$@" >&2
}

# 1. No view reaches the Hub. ArgoUI may NAME the engine's value types — the presentation
#    IS them, and a second copy of `Head`/`HubConnection` would be two vocabularies for one
#    fact kept in step by hand (#441). What stays banned is live state: the projection that
#    reads a Hub is one file, and a view importing it would be a view taking a store.
# Comment lines are skipped: prose may say what the seam IS, and only code can cross it.
hits=$(grep -rn '\bHub\b' "$UI_SOURCES" --include='*.swift' 2>/dev/null \
  | grep -v "/$PROJECTION_FILE:" \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true)
if [ -n "$hits" ]; then
  report "a view names the Hub — only $PROJECTION_FILE may read live state (ADR-0005)" "$hits"
fi

# 2. ArgoEngine ⊥ UI frameworks. The engine stays testable from the command line, which it
#    only is while nothing in it needs a window server.
hits=$(grep -rnE '^ *import  *(SwiftUI|AppKit|Cocoa|ArgoUI)' "$ENGINE_SOURCES" 2>/dev/null || true)
if [ -n "$hits" ]; then
  report "ArgoEngine imports a UI framework — it must run under \`swift test\`, with no window (ADR-0022)" "$hits"
fi

# 3. The Xcode target holds the scene and nothing else. Everything with logic in it belongs
#    in a package, where it is testable; a `View` declared here is a view no test can reach.
hits=$(grep -rnE '(struct|class|enum) +[A-Za-z0-9_]+ *: *[^{]*\bView\b' "$APP_TARGET" \
  --include='*.swift' 2>/dev/null || true)
if [ -n "$hits" ]; then
  report "the app target declares a View — views belong in ArgoUI, the target owns only the @main scene (ADR-0022)" "$hits"
fi

# 4. And it stays the scene — the half of edge 3's sentence, "everything with logic in it belongs
#    in a package", that a grep for `View` does not check (#638). Blank and comment lines are not
#    counted, so prose that explains a seam is free.
APP_TARGET_MAX_LINES=600
lines=$(find "$APP_TARGET" -name '*.swift' -exec cat {} + 2>/dev/null \
  | grep -cvE '^[[:space:]]*(//.*)?$' || true)
if [ "$lines" -gt "$APP_TARGET_MAX_LINES" ]; then
  report "the app target is $lines code lines, over its $APP_TARGET_MAX_LINES cap (ADR-0022)" \
    "It holds the @main scene, the coordinators' observable boxes, and the AppKit panels that" \
    "cannot leave it. Everything else is a derivation, and a derivation here is one no test can" \
    "reach: the e2e suite launches onto --specimen, which never builds CockpitView at all." \
    "Move the newest derivation into ArgoEngine or ArgoUI with a test, rather than raising this."
fi

# 5. The projection is TOTAL. The cockpit's `Session` restates `HubSession` rather than holding
#    one (ADR-0027), so every public engine fact must either land in the mapping as
#    `session.<name>` or carry a `not-projected: <name> — <why>` line beside it. Without this, a
#    new engine fact reaches no surface and nothing says so — the failure mode #572 and #573 each
#    walked into by hand. `swift-boundaries.test.mjs` is the proof it stays loud.
# A member of a `public extension` is public whether or not it repeats the keyword, so the two
# contexts are matched by different rules and awk tracks which one it is in.
hub_facts() {
  awk '
    function emit(  i, name) {
      for (i = 1; i <= NF; i++)
        if ($i == "var" || $i == "let") {
          name = $(i + 1); sub(/[^A-Za-z0-9_].*/, "", name); print name; return
        }
    }
    /^public extension HubSession/ { ext = 1; next }
    /^}/ { ext = 0; next }
    ext && /^    (public )?(var|let) [A-Za-z]/ { emit(); next }
    /^    public ([a-z]+\(set\) )?(var|let) [A-Za-z]/ { emit() }
  ' "$ENGINE_SOURCES"/Hub/HubSession*.swift | sort -u
}
# The first name on a marker line; whatever follows it is the reason, which is prose.
not_projected() {
  sed -nE 's/^.*not-projected:[[:space:]]*([A-Za-z0-9_]+).*/\1/p' "$PROJECTION" | sort -u
}
# Comment lines are excluded: prose may NAME a fact, and only the mapping can land one.
mapped() {
  grep -vE '^[[:space:]]*//' "$PROJECTION" | grep -oE 'session\.[A-Za-z0-9_]+' \
    | cut -d. -f2 | sort -u
}

if [ ! -f "$HUB_SESSION" ] || [ ! -f "$PROJECTION" ] || [ ! -f "$PROJECTED" ] ||
  [ ! -f "$VALUES" ]; then
  report "edge 5 cannot see its own subjects — HubSession.swift, $PROJECTION_FILE, $PROJECTED_FILE or $VALUES_FILE has moved" \
    "Point HUB_SESSION, PROJECTION, PROJECTED and VALUES at their new homes. An edge whose input" \
    "is missing checks nothing, and nothing else in this repo would notice."
else
  facts=$(hub_facts)
  dropped=$(not_projected)
  landed=$(mapped)
  accounted=$(printf '%s\n%s\n' "$landed" "$dropped" | grep -v '^$' | sort -u)

  if [ -z "$facts" ]; then
    report "edge 5 read no public facts off HubSession — the declarations it matches have changed" \
      "Fix \`hub_facts\` in this script. An edge that matches nothing passes everything."
  fi

  hits=$(printf '%s\n' "$facts" | grep -vxF "$accounted" || true)
  if [ -n "$hits" ]; then
    report "these HubSession facts reach no cockpit surface and are not accounted for in $PROJECTION_FILE (ADR-0027)" \
      "$hits" \
      "Map each one in \`init(observed:annotations:)\`, or add a \`not-projected: <name> — <why>\`" \
      "line above it saying why the cockpit does not render it."
  fi

  # The list the other way round: an entry naming a fact that no longer exists makes the check
  # above pass for a reason that stopped being true.
  hits=$(printf '%s\n' "$dropped" | grep -vxF "$facts" || true)
  if [ -n "$hits" ]; then
    report "\`not-projected:\` in $PROJECTION_FILE names facts HubSession no longer has" "$hits"
  fi

  # And a fact cannot be both. Left unchecked, a stale entry would go on covering a fact that has
  # since been landed, and the entry's reason would read as current.
  hits=$(printf '%s\n' "$landed" | grep -xF "$dropped" || true)
  if [ -n "$hits" ]; then
    report "these facts are mapped in $PROJECTION_FILE AND listed \`not-projected:\`" "$hits" \
      "Drop the \`not-projected:\` line: the fact is rendered, so its reason is out of date."
  fi

  # 5b. And a fact handed straight through lands on the slot of its OWN name. Totality proves a
  #     fact was mentioned, never that it reached the right field, so `spentTokens:
  #     session.cachedTokens` is a swap both halves above call accounted for (#755). A fact crosses
  #     three hands — named into the init, unpacked out of a value in its body, and unpacked again
  #     inside a group whose own init takes sub-groups — and any hand can drop it on the wrong slot,
  #     so all three files are read (#1051). Only the verbatim slots are checked:
  #     an argument that is a whole expression is a derivation, and its name is the projection's.
  verbatim_pairs=$(
    awk "$AWK_READER"'
      { line = code($0)
        while (match(line, /[A-Za-z_][A-Za-z0-9_]*:[ \t]*session\.[A-Za-z_][A-Za-z0-9_]*/)) {
          hit = substr(line, RSTART, RLENGTH)
          after = substr(line, RSTART + RLENGTH, 1)
          line = substr(line, RSTART + RLENGTH)
          # A terminator, and nothing else, means the fact IS the whole argument.
          if (after == "" || after == "," || after == ")") {
            split(hit, part, ":")
            slot = part[1]
            sub(/^.*session\./, "", hit)
            if (slot != hit) print slot " <- " hit
          }
        }
        # The other hand: `self.slot = value.fact`, which is how the init unpacks a grouped value.
        if (match(line, /^[ \t]*self\.[A-Za-z_][A-Za-z0-9_]* = [a-z][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*[ \t]*$/)) {
          split(line, part, " ")
          slot = part[1]
          fact = part[3]
          sub(/^self\./, "", slot)
          sub(/^.*\./, "", fact)
          if (slot != fact) print slot " <- " fact
        }
      }
    ' "$PROJECTION" "$PROJECTED" "$VALUES" | sort -u
  )
  # The first two names on a marker line; whatever follows is prose.
  declared_renames=$(
    sed -nE 's/^.*renamed:[[:space:]]*([A-Za-z0-9_]+)[[:space:]]*<-[[:space:]]*([A-Za-z0-9_]+).*/\1 <- \2/p' \
      "$PROJECTION" "$PROJECTED" "$VALUES" | sort -u
  )

  hits=$(printf '%s\n' "$verbatim_pairs" | grep -v '^$' | grep -vxF "$declared_renames" || true)
  if [ -n "$hits" ]; then
    report "these facts land on a slot of another name in the projection (ADR-0027, #755)" \
      "$hits" \
      "A fact passed straight through takes the slot of its own name, or the projection says why" \
      "not: add a \`renamed: <slot> <- <fact> — <why>\` line beside it, in $PROJECTION_FILE," \
      "$PROJECTED_FILE or $VALUES_FILE. This is the check that catches two same-typed facts" \
      "swapped, which no type and no totality check can."
  fi

  hits=$(printf '%s\n' "$declared_renames" | grep -v '^$' | grep -vxF "$verbatim_pairs" || true)
  if [ -n "$hits" ]; then
    report "\`renamed:\` in the projection names renames it no longer makes" "$hits" \
      "Drop the line: a marker for a rename that is not made would go on excusing a future one."
  fi
fi

# 6. The parameter cap reaches initializers. SwiftLint's `function_parameter_count` visits FUNCTION
#    declarations only, so an `init` is invisible to it — which is how a 27-parameter init sat under
#    a cap of 4 for as long as it did (#755). The number is SwiftLint's OWN, read off the rule this
#    edge extends, so there is no second figure to sit above it — a ratchet of 18 beside a stated
#    cap of 4 is a gate nothing anyone writes can fail (#992).
#
#    What is grandfathered is a NAMED list beside that rule, and the list may only shrink: an init
#    over the cap fails unless it is named, and a name matching no init over the cap fails too.
INIT_CAP=$(
  awk '
    /^function_parameter_count:/ { inrule = 1; next }
    inrule && /^[^ #]/ { exit }
    inrule && $1 == "error:" { print $2; exit }
  ' "$SWIFTLINT_CONFIG" 2>/dev/null
)
# One grandfathered init per line, `# INIT: <file> <count> — <why>`. The reason is required by the
# pattern: an entry with nothing said about it is not read, so it grandfathers nothing.
export INIT_EXEMPT
INIT_EXEMPT=$(
  sed -nE 's/^[[:space:]]*#[[:space:]]*INIT:[[:space:]]*([^[:space:]]+\.swift)[[:space:]]+([0-9]+)[[:space:]]+—.*/\1 \2/p' \
    "$SWIFTLINT_CONFIG" 2>/dev/null
)
if [ -z "$INIT_CAP" ]; then
  report "edge 6 cannot find its cap — no \`function_parameter_count:\` with an \`error:\` in $SWIFTLINT_CONFIG" \
    "That is the rule this edge extends to the shape SwiftLint cannot see, and this edge reads its" \
    "number rather than carrying one of its own. Without it the edge checks nothing and says so."
else
  # Printed on every run, pass or fail: a cap nothing says out loud is a cap "quality passed" can be
  # read as having held (#992).
  echo "swift-boundaries: edge 6 — initializer cap $INIT_CAP parameters, SwiftLint's own; \
$(printf '%s\n' "$INIT_EXEMPT" | awk 'NF' | wc -l | tr -d ' ') grandfathered by name in $SWIFTLINT_CONFIG"
  # Depth-counted rather than pattern-matched: a default value may itself hold commas and parens,
  # and a list wide enough to matter is always wrapped one parameter per line.
  hits=$(
    find "$APP_DIR" -name '*.swift' \
      ! -path '*/.build/*' ! -path '*/build/*' ! -path '*.xcodeproj/*' -print 2>/dev/null \
      | sort \
      | while IFS= read -r file; do
        awk -v file="$file" -v cap="$INIT_CAP" "$AWK_READER"'
          function close_list(  count) {
            count = seen ? commas + (trailing ? 0 : 1) : 0
            if (count > cap) print file ":" declared ": init takes " count " parameters"
            active = 0
          }
          {
            line = code($0); start = 1
            if (!active) {
              if (!match(line, /(^|[^.A-Za-z0-9_])init\??[ \t]*\(/)) next
              start = RSTART + RLENGTH
              active = 1; depth = 1; commas = 0; seen = 0; trailing = 0; declared = FNR
            }
            for (i = start; i <= length(line); i++) {
              char = substr(line, i, 1)
              if (char == ")" || char == "]" || char == "}") {
                if (--depth == 0) { close_list(); break }
              } else if (char == "(" || char == "[" || char == "{") depth++
              else if (char == "," && depth == 1) { commas++; trailing = 1; continue }
              if (char != " " && char != "\t") { seen = 1; trailing = 0 }
            }
          }
        ' "$file"
      done
  )
  # Matched by file and count rather than by line, because a line number moves under every edit
  # above it and a list that churns is a list nobody reads. Two inits of the same width in one file
  # take one entry each; two FILES of one name would make an entry ambiguous, and that is reported
  # rather than resolved — an entry may only ever cover the init it was written for.
  verdict=$(
    # The list reaches awk through the environment: `-v` mangles a value holding newlines, and BSD
    # awk refuses one outright.
    printf '%s\n' "$hits" | awk '
      BEGIN {
        lines = split(ENVIRON["INIT_EXEMPT"], entry, "\n")
        for (i = 1; i <= lines; i++)
          if (entry[i] ~ /[^ ]/) { allowed[entry[i]]++; named[++total] = entry[i] }
      }
      /[^ ]/ {
        path = $1; sub(/:[0-9]+:$/, "", path)
        base = path; sub(/.*\//, "", base)
        key = base " " $(NF - 1)
        if ((key in allowed) && where[key] != "" && where[key] != path)
          print "ambiguous|" key " — " where[key] " and " path
        where[key] = path
        if (allowed[key]-- > 0) next
        print "over|" $0
      }
      END {
        for (i = 1; i <= total; i++)
          if (allowed[named[i]] > 0) { allowed[named[i]]--; print "stale|" named[i] }
      }
    '
  )
  hits=$(printf '%s\n' "$verdict" | sed -n 's/^over|//p')
  if [ -n "$hits" ]; then
    report "these initializers are over the $INIT_CAP-parameter cap (rules/code-style.md, #755)" \
      "$hits" \
      "Group the list by the reading each parameter comes from and pass one value per reading, the" \
      "way CockpitPresentation.Session does. Nothing here is grandfathered by being new: the list" \
      "in $SWIFTLINT_CONFIG names what predates the gate, and $INIT_CAP is never raised to fit an init."
  fi
  hits=$(printf '%s\n' "$verdict" | sed -n 's/^stale|//p')
  if [ -n "$hits" ]; then
    report "the grandfathered list names an init that is not over the cap any more" "$hits" \
      "Delete the line. An entry left standing for an init that was grouped goes on authorising the" \
      "next one written to that width, which is how a ratchet stops descending."
  fi
  hits=$(printf '%s\n' "$verdict" | sed -n 's/^ambiguous|//p')
  if [ -n "$hits" ]; then
    report "a grandfathered entry cannot say which init it means" "$hits" \
      "Two files of one name, both over the cap at the same width. Group one of them, or the entry" \
      "covers whichever the gate reads first."
  fi
fi

if [ "$failed" -eq 1 ]; then
  echo "" >&2
  echo "Move the declaration into the package that may own it, or land the fact where the edge" >&2
  echo "above says it belongs. Never loosen a check here: the layering is what keeps the engine" >&2
  echo "runnable without a window, and the projection honest about what it drops." >&2
  exit 1
fi

echo "swift-boundaries: ok"
