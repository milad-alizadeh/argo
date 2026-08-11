/// Which of a Session's names the cockpit shows — the one decision, in the one place. BOTH the
/// roster row's and the deck header's projections must read it: `cockpit-spec.md` §4.2 — "Title
/// resolves through a stable fallback chain — explicit name → linked ticket → conversation-derived
/// … so rail and header always match" (#502 §Seams).
enum SessionTitle {
    /// `explicit → issue → derived` (#502, story 19).
    static func resolved(for session: CockpitPresentation.Session) -> String {
        session.explicitName ?? fallback(for: session)
    }

    /// The same chain with the explicit name taken out — where the rename dialog's Reset goes, and
    /// what a Session nobody renamed already shows.
    static func fallback(for session: CockpitPresentation.Session) -> String {
        session.issue?.title ?? session.title
    }
}
