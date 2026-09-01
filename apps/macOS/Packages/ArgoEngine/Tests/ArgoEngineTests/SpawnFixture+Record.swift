@testable import ArgoEngine
import Foundation

@MainActor
extension SpawnFixture {
    /// The record a spawned CLI writes: its own id, the folder it ran in, and a moment inside the
    /// claim's window.
    ///
    /// On the fixture because both halves of the spawn's story need it: `HubSpawnTests` to watch
    /// the row replaced, `HubSpawnProcessTests` for a live Session to lose the PTY under.
    func observedSpawn(cwd: String? = nil) -> TranscriptObservation {
        hubTestObservation(
            id: "session-from-cli",
            events: [
                .cwd(cwd ?? projectURL.path),
                .prompt(text: "First prompt", images: [], atMs: Date().epochMs),
                .turnEnded(.endTurn),
            ],
        )
    }
}
