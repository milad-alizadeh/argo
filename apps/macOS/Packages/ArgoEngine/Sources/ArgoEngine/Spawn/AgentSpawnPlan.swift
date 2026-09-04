import Foundation

/// Everything one spawn was decided to be, before anything has started: which CLI, where, on which
/// rung, under which claim, and what the seed asked for.
struct AgentSpawnPlan {
    let cli: AgentCLI
    let cwd: String
    let mode: SessionMode
    /// The Model and Effort this spawn opens on (#1175) — the pair the user last picked, resolved
    /// once so the argv and the row Argo publishes cannot state two different answers.
    let run: SessionRun
    let seed: SessionSeed
    let claim: SessionOwnership.ClaimID
    /// The transcript this spawn was told to write, and `nil` where it was told nothing — a resume,
    /// which has its Session already, or a CLI that takes no such flag. Held on the plan because
    /// the claim and the argv have to name the SAME file (#742).
    let namedUUID: String?
}
