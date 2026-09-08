@testable import ArgoEngine
import Foundation
import Testing

/// How a listing fails, in the vocabulary the health ledger records — because the cause is what a
/// user is told to do about it, and only one of the four is fixed by authorizing again.
@Suite("Ticket listing failure")
struct TicketListingFailureTests {
    private static func failure(
        body: String = "[]", raising: Error? = nil,
    ) async
        -> ProviderFetchError? {
        let api = RecordedGitHub(replies: [RecordedGitHub.openIssues: body], failure: raising)
        do {
            _ = try await GitHubTickets(transport: api).list(in: "acme/api", grant: .listing)
            return nil
        } catch {
            return error as? ProviderFetchError
        }
    }

    @Test
    func `a refused token is a refused grant`() async {
        // Account-level: every Binding naming that identity is down together, and one act of
        // authorizing again clears all of them.
        #expect(await Self.failure(raising: HTTPTransportError.unauthorized(code: 401, reason: nil))
            == .grantRefused)
    }

    @Test
    func `a code host that answered with an outage is unreachable`() async {
        #expect(await Self.failure(raising: HTTPTransportError.status(code: 503)) == .unreachable)
    }

    @Test
    func `a Mac with no network reads as offline`() async {
        // Nothing was asked, so nothing was refused — the grant is not in question.
        #expect(await Self.failure(raising: URLError(.notConnectedToInternet)) == .offline)
    }

    @Test
    func `a throttled read reads as rate limited`() async {
        // Binding-level and never `grantRefused`, even though GitHub throttles with the same 403 it
        // refuses a token with — the remedy is waiting, not another OAuth round-trip.
        #expect(await Self.failure(raising: HTTPTransportError.rateLimited) == .rateLimited)
    }

    @Test
    func `a scope the token cannot see is unreachable`() async {
        // Not `grantRefused`: a repository renamed away says nothing about the token, and sending
        // the user back through an OAuth round-trip would not find it.
        #expect(await Self.failure(body: #"{ "message": "Not Found" }"#) == .unreachable)
    }

    @Test
    func `a reply in no shape the adapter knows is unreachable`() async {
        #expect(await Self.failure(body: #"{ "unexpected": true }"#) == .unreachable)
    }

    /// A refusal Argo raised itself, a read the window cancelled, and two URLs nothing could be
    /// asked through. None of them put anything to a provider, so the network is fine, the grant
    /// is not in question, and nobody was asked and did not answer (#1698).
    private static let wordless: [any Error & Sendable] = [
        OutsideTheTransport.raised,
        CancellationError(),
        URLError(.cancelled),
        HTTPTransportError.malformedURL("h ttp://"),
    ]

    @Test(arguments: wordless)
    func `a failure none of the cause words is true of gets no word`(
        _ error: any Error & Sendable,
    ) {
        #expect(ProviderFetchError.reading(error) == nil)
    }

    /// The whole read path rather than the classifier alone: the adapter, the poll's own catch and
    /// the ledger, with nothing recorded at the end of it. The chip is left where it was instead of
    /// naming a fault no reader could act on (#1698).
    @Test
    func `a listing refused from outside the transport records nothing on the ledger`() async {
        let health = ConnectionHealthLedger()
        let target = PortReadTarget(binding: .stub(), projectID: "P1")
        let poll = TicketPoll(
            port: ProviderTickets(
                transport: RecordedGitHub(replies: [:], failure: OutsideTheTransport.raised),
            ),
            ledgers: TicketPoll.Ledgers(health: health, items: TicketLedger()),
        )

        await poll.poll(target)
        let reading = await health.health(of: target.projectBinding, in: "P1")

        #expect(reading.state == .healthy)
        #expect(reading.lastSuccess == nil)
    }

    @Test
    func `only a refused grant is an account-level cause`() {
        // The ledger keys the other three on the Binding, so they take one port of one Project
        // with them and leave every other Binding on that Account reading.
        #expect(ProviderFetchError.grantRefused.cause == nil)
        #expect(ProviderFetchError.offline.cause == .offline)
        #expect(ProviderFetchError.unreachable.cause == .unreachable)
        #expect(ProviderFetchError.rateLimited.cause == .rateLimited)
    }
}
