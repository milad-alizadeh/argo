import ArgoEngine
@testable import ArgoUI
import Testing

/// The badge slot's `Ready` reading (#1335, `cockpit-roster-row.md` — decisions 6 and 7).
@Suite("The roster row's ready-to-ship badge")
struct SessionRowReadyToShipTests {
    @Test
    func `a Session with the claim and no pull request draws Ready`() throws {
        let row = try #require(rows(readyToShip: true, pullRequest: nil).first)

        #expect(row.badgeWord == "Ready")
    }

    @Test
    func `a Session with no claim draws nothing`() throws {
        let row = try #require(rows(readyToShip: false, pullRequest: nil).first)

        #expect(row.badgeWord == nil)
    }

    /// Decision 7: an open pull request outranks the claim, which is still resolved upstream
    /// (`CockpitPresentation+Hub.swift`) rather than re-asked here — this fixture only proves the
    /// row draws whatever `Session.readyToShip` already settled.
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
                readyToShip: true,
            )
        }).first { $0.fold != nil })

        #expect(fold.badgeWord == nil)
    }

    private func rows(
        readyToShip: Bool,
        pullRequest: DeliveryPullRequest?,
    )
        -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(
                id: "one", status: .idle, lastSeenAtMs: 0,
                pullRequest: pullRequest, readyToShip: readyToShip,
            ),
        ])
    }
}
