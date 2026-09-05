import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Where a link pressed in the feed goes (#1178).
///
/// The whole of what the feature turns on, stated where a test can reach it: the view around it
/// only spends this answer.
@Suite("Feed ticket route")
struct FeedTicketRouteTests {
    private static let bound = FeedTicketLinks(
        address: TicketAddress(provider: .github, scope: "milad-alizadeh/argo"),
        titles: [1175: "Anchor the feed on its newest line"],
    )

    private static func url(_ text: String) throws -> URL {
        try #require(URL(string: text))
    }

    @Test func `a recognised link opens the Tickets surface on its Ticket`() throws {
        let link = try Self.url("https://github.com/milad-alizadeh/argo/issues/1175")

        #expect(Self.bound.route(of: link) == .ticket(1175))
    }

    /// Nothing is lost on the way out: a link the Binding cannot address opens the web, carrying
    /// the URL the record wrote and not a rewrite of it.
    @Test(arguments: [
        "https://github.com/someone/else/issues/1175",
        "https://linear.app/argo/issue/ARG-12",
        "https://example.com/notes",
    ])
    func `a link the Binding does not address opens the web`(link: String) throws {
        let web = try Self.url(link)

        #expect(Self.bound.route(of: web) == .web(web))
    }

    /// An unbound Project routes everything to the web, including the URL a bound one would claim.
    @Test func `an unbound Project routes every link to the web`() throws {
        let link = try Self.url("https://github.com/milad-alizadeh/argo/issues/1175")

        #expect(FeedTicketLinks.none.route(of: link) == .web(link))
    }

    /// The route and the words are one reading: the feed cannot say `#1175` over a link it would
    /// then open in a browser, or draw a URL it would open the Tickets surface on.
    @Test func `a link is worded exactly where it is routed to a Ticket`() throws {
        let ticket = try Self.url("https://github.com/milad-alizadeh/argo/issues/1175")
        let web = try Self.url("https://github.com/someone/else/issues/1175")

        #expect(Self.bound.words(of: ticket) != nil)
        #expect(Self.bound.words(of: web) == nil)
    }
}
