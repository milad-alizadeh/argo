@testable import ArgoEngine
import Foundation
import Testing

/// Walking a paged listing when the host may answer any page with `304`.
///
/// The ETag is per URL and `?page=2` is a different URL from `?page=1`, so the pages of one listing
/// are validated one at a time — and the walk has to know where the listing ENDS with no item count
/// to read it off (#1620).
@Suite("Conditional paging")
struct ConditionalPagingTests {
    private static let path = "/repos/acme/api/pulls?state=open"
    private static let onePull = ["/pulls?": PullRequestJSON.list([PullRequestJSON(number: 8)])]

    private static func walked(
        _ api: RecordedGitHub, revalidating: Bool = true,
    ) async throws
        -> PortReading<[GitHubPullRequest]> {
        try await GitHubReads(transport: api).pages(
            [GitHubPullRequest].self, of: path, grant: .listing, revalidating: revalidating,
        )
    }

    @Test
    func `a one-page listing that has not moved costs one request`() async throws {
        // The walk ends where the last one did rather than probing the page after it — otherwise a
        // saved request is spent again on an empty answer, and the ticket buys nothing (#1620).
        let api = RecordedGitHub(replies: Self.onePull, validating: ["/pulls?"])
        let reads = GitHubReads(transport: api)

        _ = try await reads.pages(
            [GitHubPullRequest].self, of: Self.path, grant: .listing, revalidating: true,
        )
        let before = await api.urls().count
        let again = try await reads.pages(
            [GitHubPullRequest].self, of: Self.path, grant: .listing, revalidating: true,
        )

        #expect(again.answer == nil)
        #expect(await api.urls().count == before + 1)
    }

    @Test
    func `a walk the backstop cut short never claims the listing is unchanged`() async throws {
        // Nothing records a span for a walk that ran out of backstop, so a `304` on its first page
        // says nothing about where the listing ends. Answering `unchanged` there would assert the
        // whole listing is current off one page of it, and walking on would spend the backstop's
        // twenty requests to learn nothing.
        let full = PullRequestJSON.list((1 ... 100).map { PullRequestJSON(number: $0) })
        let api = RecordedGitHub(replies: ["per_page=100": full], validating: ["per_page=100"])
        let reads = GitHubReads(transport: api)

        _ = try await reads.pages(
            [GitHubPullRequest].self, of: Self.path, grant: .listing, revalidating: true,
        )
        let before = await api.urls().count
        let read = try await reads.pages(
            [GitHubPullRequest].self, of: Self.path, grant: .listing, revalidating: true,
        )

        #expect(read.answer?.count == 2000)
        // One conditional page, then the twenty the walk is read again for. Not forty.
        #expect(await api.urls().count == before + 21)
    }

    @Test
    func `a walk whose pages disagree is read again for its bodies`() async throws {
        // A `304` leaves no items to splice into the gap, so a listing that moved on ONE of its
        // pages cannot be assembled from a mixed walk. It costs what it cost before this ticket.
        let api = RecordedGitHub(
            replies: [
                "&page=1": PullRequestJSON.list((1 ... 100).map { PullRequestJSON(number: $0) }),
                "&page=2": PullRequestJSON.list([PullRequestJSON(number: 101)]),
            ],
            validating: ["&page=2"],
        )

        _ = try await Self.walked(api)
        let read = try await Self.walked(api)

        #expect(read.answer?.count == 101)
    }
}
