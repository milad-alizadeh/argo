@testable import ArgoEngine
import Foundation
import Testing

@Suite("Code host terminal event times")
struct CodeHostTerminalTimeTests {
    @Test(arguments: [false, true])
    func `a terminal event keeps the host time despite later updates`(isMerged: Bool) async throws {
        let terminalTime = "2026-08-01T00:00:00Z"
        let pull = PullRequestJSON(
            number: 1720, state: "closed",
            mergedAt: isMerged ? terminalTime : nil,
            closedAt: terminalTime, updatedAt: "2026-08-02T00:00:00Z",
        )
        let pullRequest = try await read(pull)

        #expect(pullRequest.finishedAt == Date(timeIntervalSince1970: 1_785_542_400))
    }

    private static let unreadableTimes: [String?] = [nil, "not a date"]

    @Test(arguments: unreadableTimes)
    func `an unreadable terminal time stays absent`(closedAt: String?) async throws {
        let pull = PullRequestJSON(number: 1720, state: "closed", closedAt: closedAt)
        let pullRequest = try await read(pull)

        #expect(pullRequest.finishedAt == nil)
    }

    private func read(_ pull: PullRequestJSON) async throws -> DeliveryPullRequest {
        let listed = try await GitHubDeliveries(transport: RecordedGitHub(replies: [
            "/pulls?": PullRequestJSON.list([pull]),
            "check-runs": CheckRunJSON.page([]), "reviews": ReviewRoundJSON.list([]),
        ])).listed(in: "acme/api", grant: .listing)
        return try #require(listed.first?.pullRequest)
    }
}
