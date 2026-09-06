import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the roster row draws for a branch the code host holds a pull request for (#1480), through
/// the join the running app makes: a Session observed on a branch, and the Deliveries the
/// derivation landed for that Project.
///
/// The host's own state word is carried verbatim — `state` and `isDraft` are never folded into a
/// third word — and each of the four lives it can be in takes its own ink
/// (`docs/designs/cockpit-roster-row.md`).
@Suite("The roster row's pull request states")
struct RosterRowDeliveryStatesTests {
    private static let branch = "argo/#1480-read-the-pull-request"

    @Test
    @MainActor
    func `an open pull request reaches the row in the code host's own word`() async throws {
        let row = try await Self.row(carrying: .fixture(number: 1481, state: "open"))

        #expect(row.pullRequest?.number == 1481)
        #expect(row.pullRequest?.state == "open")
        #expect(row.pullRequest?.isDraft == false)
    }

    /// A draft is `open` by the host's word and a draft by its facts. Both reach the row, because
    /// folding them into one word is what would lose the difference the ink draws.
    @Test
    @MainActor
    func `a draft reaches the row as an open one that is drafted`() async throws {
        let row = try await Self.row(
            carrying: .fixture(number: 1482, state: "open", isDraft: true),
        )

        #expect(row.pullRequest?.state == "open")
        #expect(row.pullRequest?.isDraft == true)
    }

    @Test
    @MainActor
    func `a closed pull request reaches the row closed and unmerged`() async throws {
        let row = try await Self.row(carrying: .fixture(number: 1483, state: "closed"))

        #expect(row.pullRequest?.state == "closed")
        #expect(row.pullRequest?.isMerged == false)
    }

    @Test
    @MainActor
    func `a merged pull request reaches the row at its terminal state`() async throws {
        let row = try await Self.row(
            carrying: .fixture(number: 1484, state: "closed", isMerged: true),
        )

        #expect(row.pullRequest?.isMerged == true)
    }

    /// The four inks the design gives those four lives, off the same reading the row draws with.
    @Test
    func `each life takes the state ink the design gives it`() {
        let palette = ArgoTheme.graphite.color
        let open = DeliveryPullRequest.fixture(state: "open")
        let draft = DeliveryPullRequest.fixture(state: "open", isDraft: true)
        let closed = DeliveryPullRequest.fixture(state: "closed")
        let merged = DeliveryPullRequest.fixture(state: "closed", isMerged: true)

        #expect(open.ink(in: palette) == palette.delivery.open)
        #expect(draft.ink(in: palette) == palette.state.idle)
        #expect(closed.ink(in: palette) == palette.state.failure)
        #expect(merged.ink(in: palette) == palette.delivery.merged)
    }

    /// A branch the derivation landed nothing for draws no pull request — never a placeholder
    /// standing in for one nobody asked the host about.
    @Test
    @MainActor
    func `a branch with no Delivery draws no pull request at all`() async throws {
        let row = try await Self.row(carrying: nil)

        #expect(row.pullRequest == nil)
    }

    /// One roster row for a Session observed on `branch`, with the Project's Deliveries carrying
    /// `pullRequest` for that same branch — the whole join, end to end.
    @MainActor
    private static func row(
        carrying pullRequest: DeliveryPullRequest?,
    ) async throws
        -> SessionRosterProjection.Row {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await observe(hub, id: "one")
        let deliveries = pullRequest.map { [Delivery(branch: branch, pullRequest: $0)] } ?? []
        let sessions = projection(of: hub, deliveries: deliveries).sessions
        return try #require(SessionRosterProjection.rows(from: sessions).first)
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
    private static func observe(_ hub: Hub, id: String) async {
        let stream = AsyncStream<[TranscriptEvent]> { continuation in
            continuation.yield([
                .cwd("/Users/milad/Developer/argo"),
                .branch(branch),
                .prompt(text: "/implement 1480", images: [], atMs: nil),
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
