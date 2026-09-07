import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// The roster with a caption loop's headless runs folded into one row (#1073): four Sessions
/// somebody is steering, and 180 `claude -p` runs sharing one folder spending a single row
/// between them.
///
/// The state this replaces is the measured one: 180 rows of near-identical titles, with the four
/// drivable Sessions somewhere below the fold of the window.
///
/// It is also the evidence for what that one row SAYS (#1567). Three of the 180 failed, so the
/// caption carries `· 3 failed`; and every run carries one derived summary, so the opened fold is
/// where the clock that tells them apart has to be legible.
struct FoldedRosterSpecimen: View {
    /// Opens the fold for the render harness, out-ranking the state so it cannot be shut under it
    /// — as `SessionNavigator.isArchiveRevealed` does, and for the same reason.
    var isOpened = false
    var width = ArgoLayout.sidebarIdealWidth

    @State private var opened: Set<String> = []

    var body: some View {
        SessionNavigator(
            rows: Self.rows(opened: shown),
            held: .init(selection: .constant(RowSelection(one: "steered-0"))),
            openFold: { opened.formSymmetricDifference([$0]) },
        )
        .frame(width: width)
    }

    private var shown: Set<String> {
        isOpened ? opened.union(Self.folds) : opened
    }

    /// The runs' own folder, which the fold is captioned by.
    private static let loop = "/Users/milad/Developer/argo/docs/designs/prototypes"

    /// Asked for rather than spelled: a fold's id is the projection's own word.
    static let folds = SessionRosterProjection.foldIDs(from: sessions)

    /// The rows this specimen renders, which is what `SessionRosterSpecimenTests` asserts on.
    static func rows(opened: Set<String>) -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: sessions, opened: opened)
    }

    private static let sessions =
        (0 ..< 4).map { steered(at: $0) } + (0 ..< 180).map { run(at: $0) }

    /// A Session somebody is at, in its own worktree.
    private static func steered(at index: Int) -> CockpitPresentation.Session {
        let titles = [
            "/implement 852", "/implement 858",
            "Reduce open issues with subagents", "QuickBooks invoice and receipt intake",
        ]
        return CockpitPresentation.Session(
            id: "steered-\(index)",
            title: titles[index],
            access: .managed,
            status: index == 0 ? .running : .idle,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(index + 1))),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-\(852 + index)",
                workspace: .init(kind: .worktree, branch: "argo/#\(852 + index)-work"),
            ),
        )
    }

    /// Which of the loop's runs failed. Three of 180, which is what a batch's failure rate
    /// actually looks like — and the fact the fold exists to keep reachable (#1567), so the
    /// caption's `· 3 failed` and the three dots under an opened fold are the same claim.
    private static let failed: Set<Int> = [7, 96, 141]

    /// One `claude -p` run of the caption loop. Every one of them carries the SAME title,
    /// because the loop shells out once per folder with one prompt template and the CLI derives
    /// one summary from it — the measured case #1567 was written on. What tells them apart on the
    /// row is the clock each one opened at.
    private static func run(at index: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "run-\(index)",
            title: "You are naming one area of an unfamiliar codebase on",
            access: .external,
            status: failed.contains(index) ? .stopped : .idle,
            chain: .init(
                program: .init(entry: .headless),
                span: .init(
                    startedAtMs: CockpitPresentation.minutesAgo(35 + index),
                    lastSeenAtMs: CockpitPresentation.minutesAgo(34 + index),
                ),
            ),
            work: .init(location: loop, workspace: .init(kind: .main, branch: "main")),
        )
    }
}

#Preview("Folded roster — 180 Sessions on one row") {
    FoldedRosterSpecimen()
        .frame(height: 420)
        .argoAppearance()
}

#Preview("Folded roster — the fold opened") {
    FoldedRosterSpecimen(isOpened: true)
        .frame(height: 420)
        .argoAppearance()
}
