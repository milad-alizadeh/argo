import ArgoDesign
import SwiftUI

/// The deck's one chrome row: the Ticket link, the pull request link and the branch, then the
/// tabs, on the leading edge — `TabLineInstruments` on the trailing one. The tabs are `DeckTabs`
/// since #404; the Ticket link is what sits ahead of them (#1092), the pull request link beside
/// it since #1592, and the branch beside that since #1232.
///
/// Ticket, pull request, then branch, in that order: all three name what this Session is FOR and
/// what it has produced, and the Ticket is the one a reader goes looking for first. None of the
/// three is a tab, so all sit ahead of the strip.
package struct SessionTabLine: View {
    /// Absent when nothing is selected. The line holds its height and says nothing — every zone
    /// below the canopy is inset by it.
    let header: SessionHeaderProjection.Header?
    /// What this line's two controls DO — see `SessionHeaderIntents`.
    var intents = SessionHeaderIntents()

    /// Which pane the deck is reading. Held here rather than above, because the deck draws one
    /// pane: the day a second one ships (#269 is Delivery's) this rises to whoever holds the two.
    @State private var tab = DeckTab.opening

    package var body: some View {
        HStack(spacing: ArgoSpacing.loose) {
            SessionIssueLink(row: header?.issue)
            SessionPullRequestLink(pullRequest: header?.pullRequest)
            SessionCheckoutMark(checkout: header?.checkout)
            // The strip takes what the instruments leave, which is what holds the tabs leading.
            DeckTabs(selection: $tab)
            TabLineInstruments(header: header, intents: intents)
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        header: SessionHeaderProjection.Header?,
        intents: SessionHeaderIntents = SessionHeaderIntents(),
    ) {
        self.header = header
        self.intents = intents
    }
}

// The width the instruments are squeezed to at the narrowest deck the window allows.
