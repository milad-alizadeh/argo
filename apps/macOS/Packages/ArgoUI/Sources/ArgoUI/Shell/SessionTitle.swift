/// Which of a Session's names the cockpit shows — the one decision, in the one place.
///
/// It is spelled here rather than inside either projection because it is drawn TWICE: the roster
/// row and the deck's header both name the same Session, and two copies of a fallback chain is how
/// a row and the header above it come to disagree about what the user renamed. Both projections
/// call this and both assert through it (#502 §Seams).
///
/// That BOTH read it is the spec's own requirement, not an extension of it: `cockpit-spec.md` §4.2
/// — "Title resolves through a stable fallback chain — explicit name → linked ticket →
/// conversation-derived … so rail and header always match."
///
/// Not a computed property on `CockpitPresentation.Session`, for the reason the projections exist
/// at all: the presentation is the VALUE the shell is handed, and a rendering decision living on
/// it would be a decision every surface inherits without having asked for it.
enum SessionTitle {
    /// `explicit → issue → derived`. The name the user set beats both the linked issue's title and
    /// the one derived from the transcript, because the whole point of setting one is that it is
    /// the name you then see (#502, story 19).
    static func resolved(for session: CockpitPresentation.Session) -> String {
        session.explicitName ?? fallback(for: session)
    }

    /// The same chain with the explicit name taken out — what the title falls BACK to, which is
    /// where the rename dialog's Reset goes and what a Session nobody renamed already shows.
    ///
    /// The issue's title rather than the derived one, where a provider gave one: resetting undoes
    /// the rename, and undoing it lands wherever the Session would have been without it.
    static func fallback(for session: CockpitPresentation.Session) -> String {
        session.issue?.title ?? session.title
    }
}
