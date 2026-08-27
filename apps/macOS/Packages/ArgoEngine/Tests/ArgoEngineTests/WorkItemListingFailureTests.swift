@testable import ArgoEngine
import Foundation
import Testing

/// How a listing fails, in the vocabulary the health ledger records — because the cause is what a
/// user is told to do about it, and only one of the four is fixed by authorizing again.
@Suite("Work Item listing failure")
struct WorkItemListingFailureTests {
    private static let grant = AccountGrant(accessToken: "ghu_listing", scopes: ["repo"])

    private static func failure(
        body: String = "[]", raising: Error? = nil,
    ) async
        -> WorkItemFetchError? {
        let api = RecordedIssues(replies: ["&page=1": body], failure: raising)
        do {
            _ = try await GitHubWorkItems(transport: api).list(in: "acme/api", grant: Self.grant)
            return nil
        } catch {
            return error as? WorkItemFetchError
        }
    }

    @Test
    func `a refused token is a refused grant`() async {
        // Account-level: every Binding naming that identity is down together, and one act of
        // authorizing again clears all of them.
        #expect(await Self.failure(raising: HTTPTransportError.unauthorized(code: 401))
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
        // GitHub hands its throttle back as a 4xx BODY, which the transport passes through like
        // any other answer. Read as an unparseable reply it would surface as `unreachable`, and
        // the one cause whose remedy is waiting would be the one nothing can see.
        let body = #"{ "message": "API rate limit exceeded for user ID 1." }"#

        #expect(await Self.failure(body: body) == .rateLimited)
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

    @Test
    func `only a refused grant is an account-level cause`() {
        // The ledger keys the other three on the Binding, so they take one port of one Project
        // with them and leave every other Binding on that Account reading.
        #expect(WorkItemFetchError.grantRefused.cause == nil)
        #expect(WorkItemFetchError.offline.cause == .offline)
        #expect(WorkItemFetchError.unreachable.cause == .unreachable)
        #expect(WorkItemFetchError.rateLimited.cause == .rateLimited)
    }
}
