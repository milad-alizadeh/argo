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
            .deliveries(in: "acme/api", grant: .listing)
    }

    private static func replies(
        pulls: [PullRequestJSON],
        checks: String = CheckJSON.runs([]),
        reviews: String = CheckJSON.reviews([]),
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
        #expect(listed.first?.pullRequest?.number == 8)
    }

    @Test
    func `a pull request state is the word the host uses for it`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8, state: "closed", draft: true)],
        ))

        // Verbatim, and never folded together with `draft` into a state GitHub has no name for.
        #expect(listed.first?.pullRequest?.state == "closed")
        #expect(listed.first?.pullRequest?.isDraft == true)
    }

    @Test
    func `a check keeps the name and the conclusion the host gave it`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8)],
            checks: CheckJSON.runs([.init(name: "quality / swift", conclusion: "failure")]),
        ))

        #expect(listed.first?.checks == [DeliveryCheck(name: "quality / swift", status: "failure")])
    }

    @Test
    func `a check still running reads the word for where it is`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8)],
            checks: CheckJSON.runs([.init(name: "macos", status: "in_progress")]),
        ))

        #expect(listed.first?.checks.map(\.status) == ["in_progress"])
    }

    @Test
    func `checks are flat, and the steps inside a run are not read`() async throws {
        // GitHub nests steps inside a check run; `CONTEXT.md` L4 fixes Checks at one level, so a
        // run with steps is one Check and never a tree of them.
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8)],
            checks: CheckJSON.runs([.init(name: "macos", conclusion: "success")]),
        ))

        #expect(listed.first?.checks.count == 1)
    }

    @Test
    func `a review verdict keeps the host's own case`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8)],
            reviews: CheckJSON.reviews([.init(author: "octocat", state: "CHANGES_REQUESTED")]),
        ))

        #expect(listed.first?.reviews.map(\.verdict) == ["CHANGES_REQUESTED"])
        #expect(listed.first?.reviews.first?.author == "octocat")
        #expect(listed.first?.reviews.first?.reviewedSHA == "c0ffee")
    }

    @Test
    func `a merged pull request is read from the moment the host stamped it`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8, state: "closed", mergedAt: "2026-08-01T00:00:00Z")],
        ))

        #expect(listed.first?.pullRequest?.isMerged == true)
    }

    @Test
    func `a closed pull request that never merged is not read as merged`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8, state: "closed")],
        ))

        #expect(listed.first?.pullRequest?.isMerged == false)
    }

    @Test
    func `the Diff is addressed by the commit the host named`() async throws {
        let listed = try await Self.list(Self.replies(
            pulls: [PullRequestJSON(number: 8, base: "develop", headSHA: "abc123")],
        ))

        #expect(listed.first?.pullRequest?.headSHA == "abc123")
        #expect(listed.first?.pullRequest?.baseBranch == "develop")
    }
}
