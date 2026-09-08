@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

@Suite("Mode walks during a Turn")
@MainActor
struct DriveModeRunningTests {
    @Test(arguments: [
        ("auto", SessionMode.code, 2),
        ("auto", SessionMode.readOnly, 3),
        ("acceptEdits", SessionMode.auto, 2),
        ("acceptEdits", SessionMode.readOnly, 1),
        ("plan", SessionMode.readOnly, 0),
    ])
    func `a walk within its endpoints moves while the Turn runs`(
        observed: String, target: SessionMode, writes: Int,
    ) async throws {
        let live = Mutex<Set<String>>([])
        let fixture = try SpawnFixture(liveness: { live.withLock { $0 } })
        defer { fixture.remove() }
        live.withLock { $0 = [fixture.resolvedProjectPath] }
        _ = try await fixture.hub.spawnSession()
        await fixture.hub.refreshLiveness()
        await hubObserveToEnd(fixture.hub, hubTestObservation(
            id: "session-from-cli",
            events: [
                .cwd(fixture.projectURL.path),
                .mode(cli: observed),
                .prompt(text: "Keep working", images: [], atMs: Date().epochMs),
            ],
        ))
        #expect(fixture.hub.sessions.map(\.status) == [.running])
        try await fixture.hub.driver.setMode(target, for: "session-from-cli")
        #expect(fixture.host.started.last?.written == Array(repeating: "\u{1B}[Z", count: writes))
        #expect(fixture.hub.sessions.first?.mode.rung == target)
    }
}
