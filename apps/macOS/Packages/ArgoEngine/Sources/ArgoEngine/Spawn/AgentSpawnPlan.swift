import Foundation

/// Everything one spawn was decided to be, before anything has started: which CLI, where, on which
/// rung, under which claim, and what the seed asked for.
struct AgentSpawnPlan {
    let cli: AgentCLI
    /// Resolved before the claim was opened, so the folder claimed and the folder run in are one.
    let cwd: String
    let mode: SessionMode
    let seed: SessionSeed
    let claim: SessionOwnership.ClaimID
}
