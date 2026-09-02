@testable import ArgoEngine
@testable import ArgoUI
import Foundation
import Observation
import Synchronization
import Testing

/// What may re-run the scene root (#858 Bug 2, acceptance).
///
/// `ArgoApp.body` folds `CockpitPresentation(pointing:hub:readings:)` once a pass and hands it to
/// the shell, so every observed property that fold TOUCHES is a dependency of the whole cockpit:
/// one bump re-renders the roster and all 42 rows of it. The ticket recorded that root running on
/// a metronome with nothing on screen changing.
///
/// The rule is one line: a fact that did not move is not published. `RosterPublishingTests` and
/// `WorldReadingsPublishingTests` hold each publisher at the source, in the engine. This holds the
/// WIRING — that the fold really is what registers those dependencies — because a claim about a
/// publisher is satisfied by a projection nothing observes through (#997 gap 4).
@Suite("Cockpit root invalidation")
@MainActor
struct CockpitRootInvalidationTests {
    /// The negative case, and the acceptance criterion said as a test: a claim republished with the
    /// fact it already held moves nothing on screen, so it may not re-run the root.
    @Test
    func `a fact republished unchanged does not re-run the root`() async {
        let hub = await Self.reading()
        hub.claims.publish(companionLiveness: .live, for: Self.claim)
        let root = Self.watchingTheRoot(of: hub)

        hub.claims.publish(companionLiveness: .live, for: Self.claim)

        #expect(!root.wasInvalidated)
    }

    /// The control. Without it the case above passes over a fold that observes nothing at all,
    /// which is the way this class of gate fails green.
    @Test
    func `a fact that moved does re-run the root`() async {
        let hub = await Self.reading()
        hub.claims.publish(companionLiveness: .live, for: Self.claim)
        let root = Self.watchingTheRoot(of: hub)

        hub.claims.publish(companionLiveness: .dropped, for: Self.claim)

        #expect(root.wasInvalidated)
    }

    private static let claim = SessionOwnership.ClaimID(value: "cockpit-root")

    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-cockpit-root")

    /// Take the pass the app takes, under observation, and hand back what says whether it was
    /// invalidated. `onChange` runs on the mutating side before the write lands, so the flag is
    /// what these cases assert and never the projection.
    private static func watchingTheRoot(of hub: Hub) -> RootPass {
        let pass = RootPass()
        withObservationTracking { _ = projection(of: hub) } onChange: { pass.invalidate() }
        return pass
    }

    private static func projection(of hub: Hub) -> CockpitPresentation {
        CockpitPresentation(projects: [], activeProjectID: nil, hub: hub, readings: .none)
    }

    /// A roster with one settled Session on it, so the fold has a row to project and the counters
    /// behind it are all registered.
    private static func reading() async -> Hub {
        let hub = Hub(projectURL: projectURL)
        await hub.startObserving(TranscriptObservation(
            id: "root",
            sourceURL: URL(fileURLWithPath: "/tmp/argo-cockpit-root/root.jsonl"),
            events: AsyncStream { continuation in
                continuation.yield([.title("Reading")])
                continuation.finish()
            },
        ))
        for _ in 0 ..< 200 where projection(of: hub).sessions.isEmpty {
            await Task.yield()
        }
        return hub
    }
}

/// One pass of the scene root, and whether anything invalidated it. Behind a `Mutex` because
/// `onChange` is `@Sendable` and the checker will not take our word for where it runs.
private final class RootPass: Sendable {
    private let invalidated = Mutex(false)

    var wasInvalidated: Bool {
        invalidated.withLock { $0 }
    }

    func invalidate() {
        invalidated.withLock { $0 = true }
    }
}
