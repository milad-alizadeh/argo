@testable import ArgoEngine
import Foundation

@MainActor
extension SpawnFixture {
    /// The record a spawned CLI writes: its own id, the folder it ran in, and a moment inside the
    /// claim's window.
    ///
    /// On the fixture because both halves of the spawn's story need it: `HubSpawnTests` to watch
    /// the row replaced, `HubSpawnProcessTests` for a live Session to lose the PTY under.
    ///
    /// The transcript and the prompt are named so a suite driving TWO fresh spawns can give each
    /// its own file and its own title, which is the pair #1479 is about.
    func observedSpawn(
        chainID: String = spawnedChainID,
        prompt: String = "First prompt",
        cwd: String? = nil,
    )
        -> TranscriptObservation {
        hubTestObservation(
            id: chainID,
            events: [
                .cwd(cwd ?? projectURL.path),
                .prompt(text: prompt, images: [], atMs: Date().epochMs),
                .turnEnded(.endTurn),
            ],
        )
    }
}
