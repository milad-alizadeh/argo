/// The roster's foot and what is behind it — the archived list's own projection, split off
/// `SessionRosterProjection.swift` so neither file owns two subjects.
extension SessionRosterProjection {
    /// What the foot of the roster says, read and heard — one value, so nothing guards the same
    /// emptiness twice.
    struct Foot: Equatable {
        let label: String
        let announcement: String
    }

    /// Whether the roster draws what is behind its foot — the reader's own toggle, OR the selection
    /// sitting back there.
    ///
    /// The second clause is the roster's decision and not the view's, which is why it is here where
    /// a test can reach it. The deck renders whatever the selection names, so a foot shut over the
    /// selected Session leaves the roster drawing NO row for the Session the feed is drawing: the
    /// two surfaces then name two different Sessions, which `CONTEXT.md` Honesty tier forbids.
    /// Archiving the row being read is the way into that state.
    static func isArchiveOpen(showing: Bool, selection: String?, in archived: [Row]) -> Bool {
        guard let selection, !showing else { return showing }
        return archived.contains { $0.id == selection }
    }

    /// The foot, and `nil` where there is nothing behind it (`cockpit-spec.md` §4.1).
    static func archivedFoot(_ archived: [Row]) -> Foot? {
        guard archived.isEmpty == false else { return nil }
        let count = archived.count
        return Foot(
            label: "Archived (\(count))",
            // Said in words for the reader who is hearing it, because `(2)` reads out as
            // punctuation.
            announcement: "Archived, \(count) Session\(count == 1 ? "" : "s")",
        )
    }
}
