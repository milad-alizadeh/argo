# The summary half of `record-figures.sh`: least of N per arm, the fold between the arms, and the
# one check a run of this kind is allowed to make. Its own file because a here-document of awk
# inside the shell script is a program nothing can lint.
#
# One reading a line, tagged with its arm by the shell:
#
#   <arm> <slug> fresh=<n>ms recorded-debug=<n>ms recorded-release=<n>ms on=<machine> fold=<n|unbound>
#
# `expected` and `arms` come from the shell rather than from what a run printed, because a set
# built from the readings that ARRIVED cannot miss the one that never did.

BEGIN {
    split(expected, wanted, /[[:space:]]+/)
    for (at in wanted) if (wanted[at] != "") want[wanted[at]] = 1
    split(arms, arm, /[[:space:]]+/)
}

{
    delete field
    for (at = 3; at <= NF; at++) {
        split($at, pair, "=")
        sub(/ms$/, "", pair[2])
        field[pair[1]] = pair[2]
    }
    slug = $2
    # First-seen order, kept because this table is a report a person copies into `PerfBudgets` by
    # hand: awk's own order over a hash differs between implementations and between runs, and two
    # artifacts nobody can diff are two artifacts nobody checks.
    if (!(slug in seen)) order[++figures] = slug
    seen[slug]++
    counted[$1, slug]++
    machine = field["on"]
    told[slug] = field["fold"]
    fold = told[slug]
    sub(/x$/, "", fold)
    recorded[slug] = fold
    fresh = field["fresh"] + 0
    if (!(($1, slug) in least) || fresh < least[$1, slug]) least[$1, slug] = fresh
}

END {
    # A figure read the wrong number of times, or not at all: a case that failed, crashed or was
    # skipped, and `swift test` exits 0 through all three (#918). Counted per arm against the
    # NAMED list, so a case that fell over in both arms leaves a hole something can see.
    for (slug in seen) {
        if (!(slug in want)) {
            printf "record-figures: %s is not a figure this run expects — name it in FIGURES\n", \
                slug > "/dev/stderr"
            bad++
        }
    }
    for (slug in want) {
        for (at in arm) {
            if (counted[arm[at], slug] != rounds) {
                printf "record-figures: %s read %d times in %s, not once per round (%d)\n", \
                    slug, counted[arm[at], slug] + 0, arm[at], rounds > "/dev/stderr"
                bad++
            } else if (least[arm[at], slug] <= 0) {
                # Zero is not a fast path, it is a reading the clock could not see or a field this
                # parser did not find — and it is a division by zero two lines further down.
                printf "record-figures: %s read 0 ms in %s, which no instrument here can mean\n", \
                    slug, arm[at] > "/dev/stderr"
                bad++
            }
        }
    }
    if (bad) exit 1

    printf "\nrecord-figures: least of %d interleaved rounds, in milliseconds\n\n", rounds
    printf "  %-30s %9s %9s %7s %14s\n", "figure", "debug", "release", "fold", "recorded fold"
    for (at = 1; at <= figures; at++) {
        slug = order[at]
        folds[slug] = least["debug", slug] / least["release", slug]
        printf "  %-30s %9.2f %9.2f %7.2f %14s\n", slug, least["debug", slug], \
            least["release", slug], folds[slug], told[slug]
    }

    # What may be CHECKED here, and nothing else: a quotient of two readings of the SAME work in
    # the same shape, which is the only kind ADR-0028 Rule 8 lets a bound sit on. The seconds
    # themselves are the box's as much as the code's, on a hosted runner as much as on a laptop.
    if (machine != "quiet-runner") {
        printf "\nrecord-figures: nothing to check against — PerfBudgets' figures are a %s's, so" \
            " no fold binds yet (#1024). Land a quiet run's and this check arms itself.\n", machine
        exit 0
    }
    # 3x is Rule 7's number. Spending it in BOTH directions is this script's own choice and not the
    # rule, which bounds only how loose a budget may be: a fold that COLLAPSED is release losing
    # ground against debug, which is the regression worth catching here, and one that ran away is
    # the debug arm regressing instead. Either way the work moved and the figure is stale.
    for (at = 1; at <= figures; at++) {
        slug = order[at]
        if (folds[slug] > recorded[slug] * 3 || folds[slug] < recorded[slug] / 3) {
            printf "record-figures: %s folds %.2f against a recorded %s — outside 3x either way\n", \
                slug, folds[slug], told[slug] > "/dev/stderr"
            missed++
        }
    }
    if (missed) exit 1
    printf "\nrecord-figures: every fold within 3x of what PerfBudgets records\n"
}
