@testable import ArgoEngine
import Foundation
import Testing

/// What a roster row says about its Plan before anybody has selected the Session (#1594).
///
/// The Plan is the one roster fact a bounded read cannot rebuild. It is written one entry at a time
/// and IS the fold of every write from the file's first, so a reader holding the file's two ends
/// holds three of a Session's thirty writes — and what it rebuilds from those is a list of three
/// entries, which is wrong rather than stale. The fixture puts every plan write in the middle of
/// the file, where no end-window reaches it.
@Suite("Cold launch plan")
struct ColdLaunchPlanTests {
    /// The steps the fixture writes. Enough that a partial fold is visibly a different list.
    private static let steps = 12

    /// AC 1 and 2: the row a cold launch draws is the row selecting the Session draws — same step
    /// count, same done count, same in-progress step.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a cold launch draws the Plan selecting the Session draws`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture)
        let chosen = try #require(hub.sessions.first?.id)
        let cold = try #require(Self.plan(of: chosen, in: hub))

        await hub.readSelected(sessionID: chosen)
        await hubSettle { hub.session(id: chosen)?.transcriptExtent == .whole }

        #expect(Self.plan(of: chosen, in: hub) == cold)
        await hub.disconnect()
    }

    /// And what that Plan IS, stated rather than only compared: a list of twelve, eleven of them
    /// done and the last one running.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `the whole list is drawn on a row whose file was never read whole`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture)
        let session = try #require(hub.sessions.first)
        let plan = try #require(Self.plan(of: session.id, in: hub))

        #expect(session.transcriptExtent == .excerpt)
        #expect(plan.entries.count == Self.steps)
        #expect(plan.entries.map(\.text) == (0 ..< Self.steps).map { "\(planStepPrefix)\($0)" })
        #expect(plan.entries.filter { $0.status == .completed }.count == Self.steps - 1)
        #expect(plan.entries.last?.status == .inProgress)
        await hub.disconnect()
    }

    /// AC 5. The fixture's last step is created in the file's TAIL and every earlier one in its
    /// middle, so the fold of the two ends alone is a list of one: `Step 11`, in progress. Every
    /// entry on it is real and its status is right, which is exactly why nothing downstream could
    /// tell it from a whole list. What must never reach a row is that list.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a Plan folded from part of the record never reaches a row`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture)
        let session = try #require(hub.sessions.first)
        let plan = try #require(Self.plan(of: session.id, in: hub))

        // The middle of the file was never read, and the list is whole all the same.
        #expect(!said(by: session).contains { $0.hasPrefix("\(fillerPrefix)200") })
        #expect(plan.entries.count == Self.steps)
        #expect(plan.entries.first?.text == "\(planStepPrefix)0")
        await hub.disconnect()
    }

    /// AC 2's other transcript, #1559: not one plan record inside the last 64 KiB. The two ends
    /// fold to NO list at all here rather than a short one, which is the row the ticket's
    /// screenshot shows — a Session with a Plan and no `PlanBar` on it.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a row draws its Plan with no plan record in the file's tail`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture, placing: .noneInTheTail)
        let session = try #require(hub.sessions.first)
        let plan = try #require(Self.plan(of: session.id, in: hub))

        #expect(session.transcriptExtent == .excerpt)
        #expect(plan.entries.map(\.text) == (0 ..< Self.steps).map { "\(planStepPrefix)\($0)" })
        #expect(plan.entries.filter { $0.status == .completed }.count == Self.steps - 1)
        #expect(plan.entries.last?.status == .inProgress)
        await hub.disconnect()
    }

    /// A live write after the bounded read folds onto the scanned list rather than starting a new
    /// one — which is the whole reason the scan hands its LEDGER over and not just its answer.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a step written after the launch read joins the list already drawn`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let hub = try await Self.connected(to: fixture)
        let session = try #require(hub.sessions.first)
        let url = try #require(session.sourceURL)

        try fixture.append(created: "step-late", subject: "\(planStepPrefix)late", to: url)
        await hubSettle {
            Self.plan(of: session.id, in: hub)?.entries.count == Self.steps + 1
        }

        let plan = try #require(Self.plan(of: session.id, in: hub))
        #expect(plan.entries.last?.text == "\(planStepPrefix)late")
        #expect(plan.entries.filter { $0.status == .completed }.count == Self.steps - 1)
        await hub.disconnect()
    }

    /// The newest list one row holds, or nothing where it holds none.
    @MainActor
    private static func plan(of sessionID: String, in hub: Hub) -> Plan? {
        hub.session(id: sessionID)?.events.reversed().compactMap { event -> Plan? in
            guard case let .plan(plan) = event else { return nil }
            return plan
        }.first
    }

    /// A Hub over one transcript long enough that its two ends do not meet, whose plan writes are
    /// laid halfway through it.
    @MainActor
    private static func connected(
        to fixture: RecordDirectoryFixture,
        placing shape: FixturePlanShape = .someInTheTail,
    ) async throws
        -> Hub {
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        try fixture.write(
            FixtureTranscript(cwd: projectURL.path, fillerRecords: 400),
            planSteps: steps,
            placing: shape,
        )
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(projectURL: projectURL, transcriptURLs: []))
        await hubSettle { hub.sessions.count == 1 }
        return hub
    }
}
