import ArgoEngine

/// What the roster says about its own NAMES — the one derivation the mirror is triggered by and
/// performed over (#1623). In the package rather than on the coordinator for the reason ADR-0022
/// gives: a derivation in the app target is one no test can reach.
public extension CockpitPresentation {
    /// The name every Session is drawn under, keyed by chain id, with the facts the mirror needs
    /// beside each one.
    ///
    /// Read off `SessionRosterProjection.naming(for:among:)` and NOT re-decided here — the same
    /// route the deck header takes to the same answer (#1391). It has to be that route and not the
    /// flat `SessionTitle.namings(across:)`: the roster contests a Ticket's words in GROUPS, the
    /// archive apart from the roster and each fold apart from its list (#1251), so a pass taken
    /// over every row at once refuses words the visible row is actually drawing. Mirroring that
    /// answer would put a name on the phone the desk never draws, which is the disagreement this
    /// ticket exists to end.
    ///
    /// `takesTypedLine` rides along because it is what the sweep is triggered BY as much as
    /// performed over: a Turn ending is the moment a refused `/rename` can go, and a map that did
    /// not move then is a retry that never happened.
    @MainActor
    var namesToMirror: [String: SessionNameDraw] {
        sessions.reduce(into: [String: SessionNameDraw]()) { draws, session in
            // A spawn Argo has not heard from yet takes a typed line by every reading Argo has
            // (`SessionStatus.starting`), and the CLI has not drawn its prompt: the line is
            // swallowed by the TUI's boot and the driver reports it sent. Skipped rather than
            // gated in the mirror, because a keystroke that went nowhere would be filed as one
            // that landed and never retried (#1623).
            guard session.status != .starting,
                  let naming = SessionRosterProjection.naming(for: session.id, among: sessions)
            else { return }
            draws[session.id] = SessionNameDraw(
                name: naming.title,
                drawsDerivedTitle: naming.drawsDerivedTitle,
                takesTypedLine: session.status.takesTypedLine,
            )
        }
    }
}
