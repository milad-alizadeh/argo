import ArgoEngine
import Foundation
import SwiftUI

/// Which Ticket URLs this window can read, and what Argo calls each one (#1178).
///
/// A URL the agent typed is the one route into a Ticket that leaves the app. Argo already reads
/// Tickets from a provider and opens a panel on one, so a link it can address is not a web link at
/// all — it is a Ticket, and it is worded like every other Ticket the cockpit draws.
///
/// Recognition comes off the BINDING (`TicketAddress`) and never off the host: a `github.com` link
/// to some other repository is a web link and stays one, and so is every link for a provider this
/// Project is not bound to. A Binding that cannot address an item recognises none either — that is
/// the same fact read backwards, and it is why Linear is honestly empty here rather than guessed at
/// (`LinearTickets.ticketNumber(of:in:)`).
///
/// Empty by default, so every specimen, `#Preview` and unbound Project draws its links as links.
package struct FeedTicketLinks: Equatable, Sendable {
    /// Where this Project's Tickets are read, and `nil` where no Ticket provider is bound.
    package var address: TicketAddress?
    /// The titles the roster already knows, by number. A number with no title here is still a
    /// Ticket — it is worded `#1175` alone, which is what `IssueReading` says about a Ticket the
    /// provider has not named yet.
    package var titles: [Int: String] = [:]

    /// Reads nothing. Not a fallback: it is what an unbound Project honestly has.
    package static let none = FeedTicketLinks()

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(address: TicketAddress? = nil, titles: [Int: String] = [:]) {
        self.address = address
        self.titles = titles
    }

    /// Whether anything here could recognise a URL at all — the guard every reading takes first, so
    /// an unbound Project pays no scan of its feed.
    package var readsAny: Bool {
        address != nil
    }

    /// Which Ticket a URL addresses, and `nil` for every URL that addresses something else.
    package func number(of url: URL) -> Int? {
        address?.ticketNumber(of: url)
    }

    /// How Argo says this Ticket — `#1175: Anchor the feed`, or `#1175` where nothing has named it.
    ///
    /// The words come from `IssueReading` and nowhere else, so the feed cannot disagree with the
    /// roster about a Ticket they are both reading off the same link.
    package func words(of url: URL) -> String? {
        guard let number = number(of: url) else { return nil }
        return IssueReading.words(number: number, title: titles[number])
    }

    /// Where a press on this link goes. Named rather than left inline in the view, so the one
    /// decision the feature turns on is testable without rendering a row.
    package func route(of url: URL) -> Route {
        number(of: url).map(Route.ticket) ?? .web(url)
    }

    /// The two things a link in the feed can be.
    package enum Route: Equatable {
        /// A Ticket this window can show. Opens the Tickets surface on it, in this window.
        case ticket(Int)
        /// Everything else, opened the way every other link in the app is.
        case web(URL)
    }
}

package extension EnvironmentValues {
    /// What the feed under this window can recognise as a Ticket. Travels in the environment for
    /// `argoOpenTicket`'s own reason — several views separate the shell that reads the Binding from
    /// the prose row that words a link.
    ///
    /// It is replayed into every hosted cell (`FeedCellEnvironment`), because a cell inherits
    /// nothing: a row missing it draws its Ticket links as web links, which is the honest reading
    /// for an unbound Project and the wrong one for a bound one.
    @Entry var argoFeedTickets: FeedTicketLinks = .none
}
