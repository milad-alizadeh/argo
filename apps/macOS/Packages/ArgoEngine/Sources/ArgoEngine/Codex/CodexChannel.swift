import Foundation

/// The two ends of one Codex Session's wire: the line Argo writes to the server, and what Argo
/// publishes off what the server writes back. Both are the same claim's, which is why they travel
/// as one value.
@MainActor
struct CodexChannel {
    /// `false` where the line never reached the server, which is the adapter's `notDrivable`.
    let write: @MainActor (String) -> Bool
    /// The status the thread reports about itself, or `nil` to take it back — where the arm said
    /// nothing Argo can claim, and where the process behind it has gone.
    let report: @MainActor (SessionStatus?) -> Void
}
