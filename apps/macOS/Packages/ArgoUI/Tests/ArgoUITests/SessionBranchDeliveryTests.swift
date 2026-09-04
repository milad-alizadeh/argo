import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Which pull request a Session's BRANCH is the life of (#1346): the join is a lookup over
/// `Readings.deliveries`, on the same branch the Ticket link already reads.
@Suite("Session branch delivery")
struct SessionBranchDeliveryTests {
    @Test
    @MainActor
    func `the branch a Session is on is what its pull request answers to`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "one", branch: "argo/#741-anchor-the-feed")
        let delivery = Delivery(
            branch: "argo/#741-anchor-the-feed", pullRequest: .fixture(state: "open"),
        )

        let session = try #require(Self.projection(of: hub, deliveries: [delivery]).sessions.first)

        #expect(session.pullRequest?.number == 1312)
    }

    @Test
    @MainActor
    func `a branch with no Delivery carries no pull request — never a placeholder`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "one", branch: "argo/#741-anchor-the-feed")

        let session = try #require(Self.projection(of: hub, deliveries: []).sessions.first)

        #expect(session.pullRequest == nil)
    }

    @MainActor
    private static func projection(
        of hub: Hub, deliveries: [Delivery],
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [], activeProjectID: nil, hub: hub,
            readings: .init(
                annotations: .empty, isTicketProviderBound: true, deliveries: deliveries,
            ),
        )
    }

    @MainActor
    private static func observe(_ hub: Hub, id: String, branch: String) async {
        let stream = AsyncStream<[TranscriptEvent]> { continuation in
            continuation.yield([
                .cwd("/Users/milad/Developer/argo"),
                .branch(branch),
                .prompt(text: "/implement 741", images: [], atMs: nil),
                .turnEnded(.endTurn),
            ])
            continuation.finish()
        }
        await hub.startObserving(TranscriptObservation(
            id: id,
            sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
            events: stream,
        ))
        for _ in 0 ..< 200
            where projection(of: hub, deliveries: []).sessions.first?.status != .idle {
            await Task.yield()
        }
    }
}
