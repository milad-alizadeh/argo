@testable import ArgoEngine
import Foundation
import Testing

/// What a run of changes to the join COSTS the window that draws it (#1538).
///
/// Every write to the join re-derives the whole cockpit, and the writes arrive in runs: a launch
/// opens one tail per transcript in the working set — 580 of them on the machine this was measured
/// on, 1,160 writes over about seventy seconds — and a settled cockpit writes once per batch at
/// the rate the record root's sweep coalesces at. The RATE is what this suite binds; what one pass
/// COSTS is `HubRosterCostTests`.
@Suite("Hub join publishing")
@MainActor
struct HubJoinPublishingTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-join-publishing")

    /// The COUNT, which is the whole point: twenty transcripts admitted inside one window are one
    /// thing happening, and the window is drawn once for them.
    @Test
    func `twenty changes inside one window publish once`() {
        let hub = Self.hub()
        let published = hub.watch.joinRevision

        for index in 0 ..< 20 {
            hub.watch.mutate { $0.add(Self.observation(index)) }
        }

        #expect(hub.watch.joinRevision == published + 1)
        #expect(hub.watch.join.transcripts.count == 20)
    }

    /// A change held is never lost: it reaches the roster when the window is up, whether or not
    /// anything else writes the join. A rate limiter that could swallow the last change would be a
    /// Session the cockpit never draws.
    @Test
    func `the change held reaches the roster with no second write`() async {
        let hub = Self.hub()
        hub.watch.mutate { $0.add(Self.observation(0)) }
        let published = hub.watch.joinRevision

        hub.watch.mutate { $0.add(Self.observation(1)) }

        #expect(hub.watch.joinRevision == published)
        await hubSettle(until: { hub.watch.joinRevision == published + 1 })
    }

    /// Leading edge: a cockpit that has been quiet longer than the window draws the next change at
    /// once, so the rate only bites where changes are arriving faster than a reader can follow.
    @Test
    func `a change after the window publishes at once`() async {
        let hub = Self.hub()
        hub.watch.mutate { $0.add(Self.observation(0)) }
        try? await Task.sleep(for: .seconds(TranscriptWatch.publishWindow))
        let published = hub.watch.joinRevision

        hub.watch.mutate { $0.add(Self.observation(1)) }

        #expect(hub.watch.joinRevision == published + 1)
    }

    /// A change that MOVED nothing publishes nothing and holds nothing (#858) — otherwise a no-op
    /// write would arm a publish the roster has no reason to draw.
    @Test
    func `a change that moved nothing publishes nothing`() {
        let hub = Self.hub()
        hub.watch.mutate { $0.add(Self.observation(0)) }
        let published = hub.watch.joinRevision

        hub.watch.mutate { _ in false }

        #expect(hub.watch.joinRevision == published)
        #expect(hub.watch.waitingPublish == nil)
    }

    private static func hub() -> Hub {
        testHub(projectURL: projectURL)
    }

    private static func observation(_ index: Int) -> TranscriptObservation {
        hubTestObservation(
            at: URL(fileURLWithPath: "\(projectURL.path)/join-\(index).jsonl"),
            events: [.cwd(projectURL.path), .title("Session \(index)", .summarised)],
        )
    }
}
