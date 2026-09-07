@testable import ArgoEngine
import Foundation
import Testing

/// Reaching a Delivery whose branch the host has deleted, by asking about the commit instead
/// (ADR-0032). GitHub deletes the head ref as it merges, so the ref filter's answer decays and
/// this is the half of the lookup that does not.
@Suite("Code host commit lookup")
struct CodeHostCommitLookupTests {
    private static let sha = "c0ffee"
    private static let commitPath = "commits/c0ffee/pulls"
    private static let branch = "argo/#1618-join-key"

    /// A host whose ref filter answers nothing and whose commit path answers `pulls` — a branch
    /// merged and deleted.
    private static func afterTheRefWasDeleted(
        _ pulls: [PullRequestJSON],
    )
        -> [String: String] {
        [
            "/pulls?state=all": "[]",
            commitPath: PullRequestJSON.list(pulls),
            "check-runs": CheckRunJSON.page([]),
            "reviews": ReviewRoundJSON.list([]),
        ]
    }

    private static func found(
        _ replies: [String: String],
    ) async throws
        -> Delivery? {
        try await GitHubDeliveries(transport: RecordedGitHub(replies: replies))
            .delivered(ofBranch: branch, at: sha, in: "acme/api", grant: .listing)
    }

    @Test
    func `a merged pull request is still read once its head ref is gone`() async throws {
        let found = try await Self.found(Self.afterTheRefWasDeleted([
            PullRequestJSON(number: 1604, state: "closed", mergedAt: "2026-08-01T00:00:00Z"),
        ]))

        #expect(found?.pullRequest?.number == 1604)
        #expect(found?.pullRequest?.isMerged == true)
    }

    @Test
    func `a live branch is never asked about by its commit`() async throws {
        let api = RecordedGitHub(replies: [
            "/pulls?state=all": PullRequestJSON.list([PullRequestJSON(number: 8)]),
            "check-runs": CheckRunJSON.page([]),
            "reviews": ReviewRoundJSON.list([]),
        ])
        _ = try await GitHubDeliveries(transport: api).delivered(
            ofBranch: "argo/#258-code-host", at: Self.sha, in: "acme/api", grant: .listing,
        )
        let asked = await api.urls()

        #expect(!asked.contains { $0.contains(Self.commitPath) })
    }

    @Test
    func `a caller holding no head commit asks about the branch and nothing else`() async throws {
        let api = RecordedGitHub(replies: Self.afterTheRefWasDeleted([
            PullRequestJSON(number: 1604, state: "closed", mergedAt: "2026-08-01T00:00:00Z"),
        ]))
        let found = try await GitHubDeliveries(transport: api)
            .delivered(ofBranch: Self.branch, in: "acme/api", grant: .listing)
        let asked = await api.urls()

        #expect(found == nil)
        #expect(!asked.contains { $0.contains(Self.commitPath) })
    }

    @Test
    func `a commit the repository does not hold reads as no Delivery`() async throws {
        // GitHub answers 422 for a local tip nobody pushed, and it arrives as a body rather than
        // as a thrown status (ADR-0032).
        let found = try await Self.found([
            "/pulls?state=all": "[]",
            Self.commitPath: #"{ "message": "No commit found for SHA: c0ffee" }"#,
        ])

        #expect(found == nil)
    }

    @Test
    func `a refusal the commit path is not entitled to still refuses the read`() async throws {
        await #expect(throws: ProviderFetchError.unreachable) {
            _ = try await Self.found([
                "/pulls?state=all": "[]",
                Self.commitPath: #"{ "message": "Validation Failed" }"#,
            ])
        }
    }

    @Test
    func `a pull request this commit only belongs to is not this branch's Delivery`() async throws {
        // GitHub answers this endpoint with the merged pull request that INTRODUCED the commit, so
        // a branch sitting at the base's tip — every freshly cut worktree — is answered with
        // whichever pull request produced that tip. Taken as the branch's own it reads a
        // never-pushed worktree as landed, and `Hub.hasLanded` reaps the folder.
        let found = try await Self.found(Self.afterTheRefWasDeleted([
            PullRequestJSON(
                number: 1671, state: "closed", mergedAt: "2026-08-01T00:00:00Z",
                branch: "argo/#1671-somebody-elses", headSHA: "deadbee",
            ),
        ]))

        #expect(found == nil)
    }

    @Test
    func `a pull request opened on a second name for the commit is filed under this branch`()
        async throws {
        // One commit can be the head of a pull request whose branch is named differently, and this
        // checkout holds such a pair. Filed under the host's name the mark lands on a row that
        // does not exist (ADR-0032).
        let found = try await Self.found(Self.afterTheRefWasDeleted([
            PullRequestJSON(
                number: 1170, state: "closed", mergedAt: "2026-08-01T00:00:00Z",
                branch: "argo/#1618-another-name-for-it",
            ),
        ]))

        #expect(found?.branch == Self.branch)
        #expect(found?.pullRequest?.number == 1170)
    }

    @Test
    func `two pull requests the host saw move together are ranked by number`() async throws {
        // Nothing else is left to order them by, and an unspecified order would answer a row
        // differently on two reads of the same page.
        let found = try await Self.found(Self.afterTheRefWasDeleted([
            PullRequestJSON(number: 1500, updatedAt: Self.sameMoment, branch: Self.branch),
            PullRequestJSON(number: 1700, updatedAt: Self.sameMoment, branch: Self.branch),
        ]))

        #expect(found?.pullRequest?.number == 1700)
    }

    @Test
    func `a commit carrying several pull requests answers with the merged one`() async throws {
        // The commit path takes no `sort`, so the order is Argo's: merged first, then whichever
        // the host saw move last.
        let found = try await Self.found(Self.afterTheRefWasDeleted([
            Self.reopened, Self.merged,
        ]))

        #expect(found?.pullRequest?.number == 1604)
    }

    @Test
    func `an unmerged commit answers with the pull request the host saw last`() async throws {
        let found = try await Self.found(Self.afterTheRefWasDeleted([
            Self.older, Self.reopened,
        ]))

        #expect(found?.pullRequest?.number == 1700)
    }

    /// Three pull requests on one commit, told apart by what ranks them.
    private static let merged = PullRequestJSON(
        number: 1604, state: "closed", mergedAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z", branch: branch,
    )
    private static let reopened = PullRequestJSON(
        number: 1700, updatedAt: "2026-09-01T00:00:00Z", branch: branch,
    )
    private static let older = PullRequestJSON(
        number: 1500, updatedAt: "2026-07-01T00:00:00Z", branch: branch,
    )
    private static let sameMoment = "2026-08-15T00:00:00Z"
}
