import SwiftUI

/// Where a Session's work went, at the foot of the reading it went from.
///
/// The one row in the feed that points at another Session. The id is what the click goes to; the
/// title is that row's own, read from the same roster the sidebar draws, so the link and the row
/// it lands on cannot disagree about what they are called.
package struct FeedHandoff: Equatable, Sendable {
    /// The row the link points at.
    let sessionID: String
    /// What that row is called, in the roster's own words.
    let title: String

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(sessionID: String, title: String) {
        self.sessionID = sessionID
        self.title = title
    }
}

extension CockpitPresentation {
    /// Where a Session's work went, read against the roster the link would land in.
    ///
    /// Nothing at all for a Session that handed off to a row this roster does not carry — a Project
    /// switch, or a spawn whose row stood down without a record ever appearing. The degrade-down
    /// rule on a link: no row is better than a click that goes nowhere.
    func handoff(of sessionID: Session.ID?) -> FeedHandoff? {
        guard let target = sessionID.flatMap({ session($0)?.handedOffTo }),
              let fresh = session(target)
        else { return nil }
        return FeedHandoff(sessionID: fresh.id, title: fresh.title)
    }
}

extension EnvironmentValues {
    /// Point the cockpit at another Session. Travels in the environment rather than through the
    /// four views between the shell and the row that offers it.
    ///
    /// Inert by default, so every specimen and `#Preview` draws the link without a navigation model
    /// behind it, and a deck rendered outside the shell cannot move a selection nobody is holding.
    @Entry var argoOpenSession: (String) -> Void = { _ in }
}
