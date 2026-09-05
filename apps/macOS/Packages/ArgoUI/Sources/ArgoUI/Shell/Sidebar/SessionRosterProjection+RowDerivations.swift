import ArgoDesign
import ArgoEngine

/// The small per-Session derivations `row(for:decided:nowMs:)` reads — split off
/// `SessionRosterProjection+Row.swift` so that file stays under the length gate.
extension SessionRosterProjection {
    /// The first fact the title is not already saying, in the row's one leading meta slot.
    ///
    /// The slash command, where the Ticket holds the title (#745) — the words it opened with are
    /// then the fact the title has no room for. Nothing where the title is the Session's own
    /// derived name: that title already IS the words this slot would otherwise repeat, so saying
    /// either twice is the waste #745 named. The Ticket used to fill that second case, but it now
    /// has an address of its own on line 3 beside the pull request (#1346), so re-saying it here
    /// is the same waste one line down (#1347).
    static func toldApart(
        for session: CockpitPresentation.Session, naming: SessionTitle.Naming,
    )
        -> String? {
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
