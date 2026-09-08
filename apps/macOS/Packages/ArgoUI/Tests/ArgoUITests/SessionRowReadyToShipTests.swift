import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The badge slot's `Ready` reading, and the pull request that outranks it (#1335,
/// `cockpit-roster-row.md` — decisions 6 and 7).
@Suite("The roster row's ready-to-ship badge")
struct SessionRowReadyToShipTests {
    private let claim = CompanionReady(reason: "3 files, 2 commits")

    @Test
    func `a Session with the claim and no pull request draws Ready`() throws {
        let row = try #require(rows(claim: claim, pullRequest: nil).first)

        #expect(row.badge == .readyToShip)
    }

    @Test
    func `a Session with no claim draws nothing`() throws {
        let row = try #require(rows(claim: nil, pullRequest: nil).first)

        #expect(row.badge == nil)
    }

    /// Decision 7: the claim is CONVENTION and the pull request is DERIVED, so the pull request
    /// wins. The claim itself is untouched — this is the SURFACE declining to draw it.
    @Test
    func `an open pull request takes the badge off the row`() throws {
        let row = try #require(
            rows(claim: claim, pullRequest: .fixture(state: "open")).first,
        )

        #expect(row.badge == nil)
    }

    /// A draft is open, by the host's own word, and the claim yields to it like any other.
    @Test
    func `a draft pull request takes it off the row too`() throws {
        let row = try #require(
            rows(claim: claim, pullRequest: .fixture(state: "open", isDraft: true)).first,
        )

        #expect(row.badge == nil)
    }

    @Test
    func `a finished pull request without claim ordering keeps Ready off`() throws {
        let merged = try #require(
            rows(claim: claim, pullRequest: .fixture(state: "closed", isMerged: true)).first,
        )
        let closed = try #require(
            rows(claim: claim, pullRequest: .fixture(state: "closed")).first,
        )

        #expect(merged.badge == nil)
        #expect(closed.badge == nil)
    }

    @Test(arguments: [false, true], [99.0, 100.0, 100.5, 101.0])
    func `a Ready badge draws only for a claim after the pull request finished`(
        isMerged: Bool, receivedAt: TimeInterval,
    ) throws {
        let row = try #require(rows(
            claim: CompanionReady(reason: nil, receivedAt: Date(timeIntervalSince1970: receivedAt)),
            pullRequest: .fixture(state: "closed", isMerged: isMerged),
        ).first)

        #expect(row.badge == (receivedAt == 101 ? .readyToShip : nil))
    }

    @Test(arguments: [false, true])
    func `a claim with no terminal event time stays hidden`(isMerged: Bool) throws {
        let pullRequest = DeliveryPullRequest(
            number: 1720, title: "Finished", state: "closed",
            facts: .init(isDraft: false, isMerged: isMerged, baseBranch: "main", headSHA: "abc123"),
            body: nil, url: nil,
        )
        let row = try #require(rows(
            claim: CompanionReady(reason: nil, receivedAt: Date(timeIntervalSince1970: 101)),
            pullRequest: pullRequest,
        ).first)

        #expect(row.badge == nil)
    }

    /// Degrade-down: a host word Argo cannot place is not evidence the pull request is over, so
    /// the quieter rendering wins and the claim stays off the row.
    @Test
    func `a host word the reading does not know keeps the badge off`() throws {
        let row = try #require(
            rows(claim: claim, pullRequest: .fixture(state: "queued")).first,
        )

        #expect(row.badge == nil)
    }

    /// The state word outranks `Ready` in the one slot they share.
    @Test
    func `a Session waiting on the reader spends its own word, not Ready`() throws {
        let row = try #require(
            SessionRosterProjection.rows(from: [
                RosterSessionFixture.session(
                    id: "one", status: .asking, lastSeenAtMs: 0, claim: claim,
                ),
            ]).first,
        )

        #expect(row.badge == .state("Needs input", .attention))
    }

    @Test
    func `a fold draws no ready badge, whatever its newest run carries`() throws {
        let fold = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            RosterSessionFixture.session(
                id: "headless-\(index)",
                workspaceLocation: RosterSessionFixture.checkout,
                access: .external,
                entry: .headless,
                status: .running,
                lastSeenAtMs: 0,
                claim: claim,
            )
        }).first { $0.fold != nil })

        #expect(fold.badge == nil)
    }

    private func rows(
        claim: CompanionReady?,
        pullRequest: DeliveryPullRequest?,
    )
        -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(
                id: "one", status: .idle, lastSeenAtMs: 0,
                pullRequest: pullRequest, claim: claim,
            ),
        ])
    }
}
