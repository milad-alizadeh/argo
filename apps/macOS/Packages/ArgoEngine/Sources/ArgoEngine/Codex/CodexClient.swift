import Foundation

/// What Argo calls itself to `codex app-server`. The server folds it into the `userAgent` it
/// resolves, so this is what a Codex-side log says the client was.
enum CodexClient {
    static let name = "argo"
    static let title = "Argo"
    static let version = "0.1.0"

    /// The Codex the adapter is verified against — `app-server` is marked experimental, so the
    /// version its shapes were exercised on is a fact worth carrying rather than a note in a doc
    /// (ADR-0024, #547).
    static let verifiedAgainst = "codex-cli 0.147.0"
}
