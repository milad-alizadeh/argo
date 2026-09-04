import SwiftUI

/// What a reader may do about the Ticket the selected Session is on (#1092) — the tickets they may
/// attach it to, the one they already attached by hand, and the write that lands the choice.
///
/// One value rather than three environment keys: the three only ever travel together, and a view
/// holding the options without the write, or the write without the pin, could draw a menu that
/// does nothing or an Unlink for a link nobody placed.
///
/// The whole capability is absent — no options, an inert write — wherever the shell has nothing
/// to offer: no Ticket provider bound, no Session selected, or a backlog nothing has read yet.
/// Every specimen and `#Preview` draws through that absence.
package struct SessionTicketLinking {
    /// One Ticket a reader may attach the Session to.
    package struct Option: Equatable, Identifiable, Sendable {
        package let number: Int
        package let title: String

        package var id: Int {
            number
        }

        /// `#1092: Route between Session and Ticket`: the number first, because a reader picking
        /// from a list of their own backlog is looking for the number they typed elsewhere.
        package var label: String {
            IssueReading.words(number: number, title: title)
        }

        package init(number: Int, title: String) {
            self.number = number
            self.title = title
        }
    }

    /// The tickets on offer, in the order the backlog serves them. Empty means there is nothing to
    /// pick, which is a different state from a picker nobody opened.
    package var options: [Option] = []
    /// The Ticket this Session is attached to by hand, `nil` where its link is derived or absent.
    /// What the Unlink verb is drawn on, and never what the link itself is read from.
    package var pinned: Int?
    /// Land the choice: a number attaches, `nil` drops the attachment.
    package var link: (Int?) -> Void = { _ in }

    /// Whether a reader can do anything here at all. A picker with no tickets in it and no pin to
    /// drop is a control that would refuse every press, so nothing draws one.
    package var isOffered: Bool {
        !options.isEmpty || pinned != nil
    }

    package init(
        options: [Option] = [],
        pinned: Int? = nil,
        link: @escaping (Int?) -> Void = { _ in },
    ) {
        self.options = options
        self.pinned = pinned
        self.link = link
    }
}

package extension EnvironmentValues {
    /// Injected once, beside `argoOpenTicket`, from the one view that holds both the navigation and
    /// the backlog. Inert by default, so a specimen draws the link with no shell behind it.
    @Entry var argoTicketLinking = SessionTicketLinking()
}
