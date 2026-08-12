import Foundation

/// Everything one spawn was decided to be, before anything has started: which CLI, where, on which
/// rung, under which claim, and what the seed asked for.
///
/// A value rather than five parameters threaded through the steps, so each step takes the whole
/// decision and none of them can be handed a `cwd` from one spawn and a `mode` from another.
struct AgentSpawnPlan {
    let cli: AgentCLI
    /// Resolved before the claim was opened, so the folder claimed and the folder run in are one.
    let cwd: String
    let mode: SessionMode
    let seed: SessionSeed
    let claim: SessionOwnership.ClaimID
}
