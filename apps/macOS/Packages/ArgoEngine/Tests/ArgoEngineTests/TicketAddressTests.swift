@testable import ArgoEngine
import Foundation
import Testing

/// Where a Ticket is read on the provider's own site, derived from the Binding alone (#872).
@Suite("Ticket address")
struct TicketAddressTests {
    @Test func `a GitHub Binding addresses its issue on the code host`() {
        let address = TicketAddress(provider: .github, scope: "milad-alizadeh/argo")

        #expect(
            address.browseURL(of: 872)
                == URL(string: "https://github.com/milad-alizadeh/argo/issues/872"),
        )
    }

    @Test(arguments: ["", "   "])
    func `a GitHub Binding with no repository behind it addresses nothing`(scope: String) {
        #expect(TicketAddress(provider: .github, scope: scope).browseURL(of: 872) == nil)
    }

    /// A Linear Binding's scope is a team id, and a Linear issue is addressed by workspace slug and
    /// team KEY — neither of which the Binding holds.
    @Test func `a Linear Binding cannot address its issue`() {
        let address = TicketAddress(
            provider: .linear, scope: "a7f3c1e0-0000-4000-8000-000000000000",
        )

        #expect(address.browseURL(of: 872) == nil)
    }

    /// The port's own answer, so #371's second adapter proves this like every other method there.
    @Test func `each adapter answers for its own provider`() {
        #expect(
            GitHubTickets.browseURL(of: 5, in: "owner/repo")
                == URL(string: "https://github.com/owner/repo/issues/5"),
        )
        #expect(LinearTickets.browseURL(of: 5, in: "team-id") == nil)
    }

    /// A ticket number no provider issues is not addressable: providers number from one.
    @Test(arguments: [0, -3])
    func `a number no provider issues addresses nothing`(number: Int) {
        #expect(TicketAddress(provider: .github, scope: "owner/repo")
            .browseURL(of: number) == nil)
    }

    /// The reverse of `browseURL(of:)`: a URL the agent typed, read back as the Ticket it addresses
    /// — off the Binding, never by pattern-matching every `github.com` link (#1178).
    @Test func `a GitHub Binding reads back its own issue URL`() throws {
        let address = TicketAddress(provider: .github, scope: "milad-alizadeh/argo")

        #expect(try address.ticketNumber(of: #require(address.browseURL(of: 1175))) == 1175)
    }

    /// Casing is the host's, not the link's: GitHub serves `Milad-Alizadeh/Argo` and
    /// `milad-alizadeh/argo` as one repository, so a Binding cannot disown a URL over it.
    @Test(arguments: [
        "https://github.com/Milad-Alizadeh/Argo/issues/1175",
        "https://www.github.com/milad-alizadeh/argo/issues/1175",
        "https://github.com/milad-alizadeh/argo/issues/1175/",
        "https://github.com/milad-alizadeh/argo/issues/1175?since=1#comment-1",
    ])
    func `a GitHub Binding reads back the spellings the host serves`(link: String) throws {
        let address = TicketAddress(provider: .github, scope: "milad-alizadeh/argo")

        #expect(try address.ticketNumber(of: #require(URL(string: link))) == 1175)
    }

    /// Everything the Binding does not address stays a web link rather than becoming a dead end.
    @Test(arguments: [
        // Another repository, on the same host.
        "https://github.com/someone/else/issues/1175",
        // A Delivery, not a Ticket — GitHub serves both out of this repository.
        "https://github.com/milad-alizadeh/argo/pull/1175",
        // The repository's own front page, and its issue listing.
        "https://github.com/milad-alizadeh/argo",
        "https://github.com/milad-alizadeh/argo/issues",
        // A number no provider issues.
        "https://github.com/milad-alizadeh/argo/issues/0",
        // Not the host at all.
        "https://example.com/milad-alizadeh/argo/issues/1175",
        // Not a number.
        "https://github.com/milad-alizadeh/argo/issues/new",
    ])
    func `a URL the Binding does not address reads back as nothing`(link: String) throws {
        let address = TicketAddress(provider: .github, scope: "milad-alizadeh/argo")

        #expect(try address.ticketNumber(of: #require(URL(string: link))) == nil)
    }

    /// The same answer `browseURL` gives, for the same reason: a Linear Binding holds a team id, so
    /// nothing here can tell one workspace's `linear.app` link from another's.
    @Test func `a Linear Binding reads back nothing`() throws {
        let address = TicketAddress(
            provider: .linear, scope: "a7f3c1e0-0000-4000-8000-000000000000",
        )
        let link = try #require(URL(string: "https://linear.app/argo/issue/ARG-12"))

        #expect(address.ticketNumber(of: link) == nil)
    }

    /// The port's own answer, so #371's second adapter proves this like every other method there.
    @Test func `each adapter reads back its own provider`() throws {
        let issue = try #require(URL(string: "https://github.com/owner/repo/issues/5"))
        let linear = try #require(URL(string: "https://linear.app/argo/issue/ARG-5"))

        #expect(GitHubTickets.ticketNumber(of: issue, in: "owner/repo") == 5)
        #expect(LinearTickets.ticketNumber(of: linear, in: "team-id") == nil)
    }
}
