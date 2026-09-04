import ArgoDesign
import ArgoEngine

/// The small per-Session derivations `row(for:decided:nowMs:)` reads — split off
/// `SessionRosterProjection+Row.swift` so that file stays under the length gate.
extension SessionRosterProjection {
    /// The first fact the title is not already saying, in the row's one leading meta slot.
    ///
    /// The Ticket, where the title fell back to the derived name or the user renamed the row — it
    /// is then the fact the row is missing (#1072). The slash command otherwise, which is where
    /// the ticket freeing the title put it (#745). Nothing at all for a row whose title already
    /// carries both, like `/implement 741`, because saying either twice is the waste #745 named.
    static func toldApart(
        for session: CockpitPresentation.Session, naming: SessionTitle.Naming,
    )
        -> String? {
        if let number = session.ticket.link?.number,
           !IssueReading.names(number: number, in: naming.title) {
            return IssueReading.words(number: number, title: nil)
        }
        guard !naming.drawsDerivedTitle else { return nil }
        return SessionRunKind.command(inDerivedTitle: session.title)
    }

    /// Whether the whole row is drawn as a Session nobody here can drive. A `switch` and not
    /// `!= .managed`, so a posture added to this axis has to answer the question.
    static func isReadOnly(_ access: CockpitPresentation.Session.Access) -> Bool {
        switch access {
        case .managed: false
        case .external, .orphaned: true
        }
    }

    /// `orphaned` is ghosted without a mark: selecting one resumes the chain (ADR-0026), so a
    /// padlock on it would be a lie.
    static func lock(for access: CockpitPresentation.Session.Access) -> String? {
        switch access {
        case .external: ArgoSymbol.readOnlySession
        case .managed, .orphaned: nil
        }
    }
}
