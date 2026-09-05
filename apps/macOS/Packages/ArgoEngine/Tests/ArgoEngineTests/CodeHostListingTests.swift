@testable import ArgoEngine
import Foundation
import Testing

/// Reading a repository's Deliveries through one Binding's grant — the read the lifecycle strip is
/// built on (`CONTEXT.md` → Ports).
@Suite("Code host listing")
struct CodeHostListingTests {
    private static func list(
        _ replies: [String: String],
    ) async throws
        -> [Delivery] {
        try await GitHubDeliveries(transport: RecordedGitHub(replies: replies))
            .inFlight(in: "acme/api", grant: .listing)
    }

    private static func replies(
        pulls: [PullRequestJSON],
        checks: String = CheckRunJSON.page([]),
        reviews: String = ReviewRoundJSON.list([]),
    )
        -> [String: String] {
        ["/pulls?": PullRequestJSON.list(pulls), "check-runs": checks, "reviews": reviews]
    }

    @Test
    func `a Delivery is keyed by the branch its pull request is the life of`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8, branch: "argo/#258-code-host")],
        ))

        #expect(listed.map(\.branch) == ["argo/#258-code-host"])
    }

    /// Everything one listing already answers about a pull request, verbatim.
    private static let pulls = [
        PullRequestJSON(number: 8),
        PullRequestJSON(number: 8, state: "closed", draft: true),
        PullRequestJSON(number: 8, state: "closed", mergedAt: "2026-08-01T00:00:00Z"),
        PullRequestJSON(number: 8, base: "develop", headSHA: "abc123"),
    ]

    @Test(arguments: pulls)
    func `a pull request crosses the boundary in the host's own words`(
        _ example: PullRequestJSON,
    ) async throws {
        let listed = try await Self.list(Self.replies(pulls: [example]))

        #expect(listed.first?.pullRequest == example.read)
    }

    struct CheckCase: Sendable {
        let run: CheckRunJSON
        let status: String
    }

    /// A finished run's word is how it went; an unfinished one's is where it is. Both are the
    /// host's.
    private static let checks = [
        CheckCase(run: CheckRunJSON(name: "macos", conclusion: "failure"), status: "failure"),
        CheckCase(run: CheckRunJSON(name: "macos", status: "in_progress"), status: "in_progress"),
    ]

    @Test(arguments: checks)
    func `a check carries the word the host gave it`(_ example: CheckCase) async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8)], checks: CheckRunJSON.page([example.run]),
        ))

        #expect(listed.first?.checks == [DeliveryCheck(name: "macos", status: example.status)])
    }

    @Test
    func `a check keeps the name the host gave it`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8)],
            checks: CheckRunJSON.page([CheckRunJSON(name: "quality / swift")]),
        ))

        #expect(listed.first?.checks.map(\.name) == ["quality / swift"])
    }

    @Test
    func `the steps inside a check run are not read as checks of their own`() async throws {
        // GitHub nests steps inside a run; `CONTEXT.md` L4 fixes Checks at one level.
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8)],
            checks: CheckRunJSON.page([CheckRunJSON(name: "macos", conclusion: "success")]),
        ))

        #expect(listed.first?.checks.count == 1)
    }

    @Test
    func `a review verdict keeps the host's own case`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8)],
            reviews: ReviewRoundJSON.list([
                ReviewRoundJSON(author: "octocat", state: "CHANGES_REQUESTED"),
            ]),
        ))

        #expect(listed.first?.reviews == [DeliveryReview(
            author: "octocat", verdict: "CHANGES_REQUESTED", reviewedSHA: "c0ffee",
        )])
    }

    @Test
    func `a branch the host holds nothing for reads as no Delivery`() async throws {
        let found = try await GitHubDeliveries(transport: RecordedGitHub(replies: [:]))
            .delivery(ofBranch: "spike/idea", in: "acme/api", grant: .listing)

        #expect(found == nil)
    }

    @Test
    func `a branch is asked about by the name the host files it under`() async throws {
        let api = RecordedGitHub(replies: Self.replies(pulls: [PullRequestJSON(number: 8)]))
        _ = try await GitHubDeliveries(transport: api)
            .delivery(ofBranch: "spike/idea", in: "acme/api", grant: .listing)

        #expect(await api.urls().contains { $0.contains("head=acme:spike/idea") })
    }

    @Test
    func `a branch name carrying a hash is asked about whole`() async throws {
        let api = RecordedGitHub(replies: Self.replies(pulls: [PullRequestJSON(number: 8)]))
        _ = try await GitHubDeliveries(transport: api)
            .delivery(ofBranch: "argo/#1398-archive", in: "acme/api", grant: .listing)

        // Unencoded, a URL reads the `#` as the start of a fragment and the host is asked about
        // every pull request in the repository instead (#1398).
        #expect(await api.urls().contains { $0.contains("head=acme:argo/%231398-archive") })
    }
}
