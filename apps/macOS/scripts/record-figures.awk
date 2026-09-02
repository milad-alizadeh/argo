# The summary half of `record-figures.sh`: least of N per arm, the fold between the arms, and the
# one check a run of this kind is allowed to make. Its own file because a here-document of awk
# inside the shell script is a program nothing can lint.
#
# One reading a line, tagged with its arm by the shell:
#
#   <arm> <slug> fresh=<n>ms recorded-debug=<n>ms recorded-release=<n>ms on=<machine> fold=<n|unbound>

BEGIN {
    split("debug release", arms, " ")
}

{
    arm = $1
    slug = $2
    delete field
    for (at = 3; at <= NF; at++) {
        split($at, pair, "=")
        sub(/ms$/, "", pair[2])
        field[pair[1]] = pair[2]
    }
    seen[arm, slug]++
    slugs[slug] = 1
    machine = field["on"]
    recorded[slug] = field["fold"]
    fresh = field["fresh"] + 0
    if (!((arm, slug) in least) || fresh < least[arm, slug]) least[arm, slug] = fresh
}

END {
    # A figure missing from an arm is a case that failed, crashed or was skipped, and `swift test`
    # exits 0 through all three (#918). Counted per arm rather than in total, so a release round
    # that dropped a case cannot be covered for by a debug one that did not.
    for (slug in slugs) {
        for (at in arms) {
            if (seen[arms[at], slug] != rounds) {
                printf "record-figures: %s read %d times in %s, not once per round (%d)\n", \
                    slug, seen[arms[at], slug] + 0, arms[at], rounds > "/dev/stderr"
                bad++
            }
        }
    }
    if (bad) exit 1

    printf "\nrecord-figures: least of %d interleaved rounds, in milliseconds\n\n", rounds
    printf "  %-30s %9s %9s %7s %9s\n", "figure", "debug", "release", "fold", "recorded"
    for (slug in slugs) {
        folds[slug] = least["debug", slug] / least["release", slug]
        printf "  %-30s %9.2f %9.2f %7.2f %9s\n", slug, least["debug", slug], \
            least["release", slug], folds[slug], recorded[slug]
    }

    # What may be CHECKED here, and nothing else. The seconds are the box's as much as the code's;
    # the fold is a quotient of two readings of the SAME work in the same shape, which is the only
    # kind ADR-0028 Rule 8 lets a bound sit on. Rule 7's 3x, applied both ways — a fold can move in
    # either direction and a shared runner moves it in both.
    if (machine != "quiet-runner") {
        printf "\nrecord-figures: nothing to check against — PerfBudgets' figures are a %s's, so" \
            " no fold binds yet (#1024). Land a quiet run's and this check arms itself.\n", machine
        exit 0
    }
    for (slug in slugs) {
        if (folds[slug] > recorded[slug] * 3 || folds[slug] < recorded[slug] / 3) {
            printf "record-figures: %s folds %.2f against a recorded %.2f — outside Rule 7's 3x\n", \
                slug, folds[slug], recorded[slug] > "/dev/stderr"
            missed++
        }
    }
    if (missed) exit 1
    printf "\nrecord-figures: every fold within 3x of what PerfBudgets records\n"
}
