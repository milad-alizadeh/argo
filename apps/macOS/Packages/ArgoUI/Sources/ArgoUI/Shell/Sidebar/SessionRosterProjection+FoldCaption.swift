import ArgoDesign
import ArgoEngine

/// What a fold's row is CALLED (#1567) — split off `SessionRosterProjection+Row.swift` so that
/// file stays under the length gate, and because the caption is its own decision.
///
/// The count alone was the one fact the reader did not need: 197 rows are visibly a lot. The fact
/// the fold was built for — whether any of the Sessions under it FAILED — was reachable only by
/// opening it and scanning 197 dots, so it rides the caption instead. And where none failed there
/// is no clause at all, which is what stops the reader opening a fold that has nothing in it for
/// them.
///
/// A sum, so it is a reading `cockpit-roster-row.md` rule 9 allows: `3 failed` is every hidden
/// Session counted, never one of them spoken for.
extension SessionRosterProjection {
    /// Both numbers off the one array, and never `Fold.count` for the first of them: a caption
    /// reading `197 Sessions · 2 failed` where three failed is the exact false claim a fold
    /// captioned by its failures cannot make, and two sources is all it takes.
    static func foldCaption(over sessions: [CockpitPresentation.Session]) -> String {
        // `Sessions` and never `runs`: `docs/domain/` defines Session, Turn, Ticket and Workspace
        // and defines no `run`, and this is the one row a reader cannot open into a deck to find
        // out what a second noun meant. Always plural — `Folding.least` is 2.
        let stands = "\(sessions.count) Sessions"
        let failed = sessions.count { SessionState.role(for: $0.status) == .failure }
        return failed == 0 ? stands : "\(stands) · \(failed) failed"
    }
}
