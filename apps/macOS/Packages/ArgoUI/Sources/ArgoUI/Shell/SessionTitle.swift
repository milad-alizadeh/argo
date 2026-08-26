/// Which of a Session's names the cockpit shows — the one decision, in the one place. BOTH the
/// roster row's and the deck header's projections must read it: `cockpit-spec.md` §4.2 — "Title
/// resolves through a stable fallback chain — explicit name → linked ticket → conversation-derived
/// … so rail and header always match" (#502 §Seams).
enum SessionTitle {
    /// `explicit → ticket → derived` (#502, story 19).
    static func resolved(for session: CockpitPresentation.Session) -> String {
        session.explicitName ?? fallback(for: session)
    }

    /// The same chain with the explicit name taken out — where the rename dialog's Reset goes, and
    /// what a Session nobody renamed already shows.
    static func fallback(for session: CockpitPresentation.Session) -> String {
        ticket(for: session) ?? session.title
    }

    /// The linked Work Item as a title, in the house form (#745).
    ///
    /// `nil` for a link the provider has not named, and not `#741` alone: a bare number carries no
    /// more than the `/implement 741` it would be replacing, and it costs the reader the words.
    static func ticket(for session: CockpitPresentation.Session) -> String? {
        guard let issue = session.issue, let title = issue.title else { return nil }
        return IssueReading.words(number: issue.number, title: title)
    }

    /// Whether what the surfaces are drawing is the derived title itself. What decides whether the
    /// run kind is worth saying a second time on the roster's secondary line (#745).
    static func drawsDerivedTitle(for session: CockpitPresentation.Session) -> Bool {
        session.explicitName == nil && ticket(for: session) == nil
    }
}
