import SwiftUI

/// Where a Session's work went, at the foot of the reading it went from.
///
/// The one row in the feed that points at another Session. Everything else there is a reading of
/// this record; this is the sentence that says the record ENDS — not because the agent stopped, but
/// because the work was carried on somewhere a reader has to be told how to reach.
///
/// A name and an id, and both are needed: the id is what the click goes to, and the name is what
/// makes the row worth clicking. Neither is invented — the id is the row the handoff published and
/// the name is that row's own title, read from the same roster the sidebar draws, so the link and
/// the row it lands on cannot disagree about what they are called.
struct FeedHandoff: Equatable, Sendable {
    /// The row the link points at.
    let sessionID: String
    /// What that row is called, in the roster's own words.
    let title: String
}

extension CockpitPresentation {
    /// Where a Session's work went, read against the roster the link would land in.
    ///
    /// Nothing at all for a Session that handed off to a row this roster does not carry — a Project
    /// switch, or a spawn whose row stood down without a record ever appearing. That is the
    /// degrade-down rule on a link: a row naming a Session Argo cannot show, or offering a click
    /// that goes nowhere, is worse than a reading that ends where the record does.
    func handoff(of sessionID: Session.ID?) -> FeedHandoff? {
        guard let target = sessionID.flatMap({ session($0)?.handedOffTo }),
              let fresh = session(target)
        else { return nil }
        return FeedHandoff(sessionID: fresh.id, title: fresh.title)
    }
}

extension EnvironmentValues {
    /// Point the cockpit at another Session. The only navigation any surface below the deck asks
    /// for, which is why it travels in the environment rather than through the four views between
    /// the shell and the row that offers it (`deckIsResizing`'s reasoning, same conclusion).
    ///
    /// Inert by default, so every specimen and `#Preview` draws the link without a navigation model
    /// behind it — and so a deck rendered outside the shell cannot silently move a selection nobody
    /// is holding.
    @Entry var argoOpenSession: (String) -> Void = { _ in }
}
