import Foundation

/// What Argo calls itself to `codex app-server`. The server folds it into the `userAgent` it
/// resolves, so this is what a Codex-side log says the client was.
enum CodexClient {
    static let name = "argo"
    static let title = "Argo"

    /// Argo's own version, off the bundle rather than written down here — a constant would go on
    /// reporting the version it was typed at for ever. Absent where there is no bundle to ask,
    /// which is every test process, and an unknown version is better said than invented.
    static var version: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
    }

    /// The Codex the adapter is verified against. `app-server` is experimental, so the version its
    /// shapes were exercised on is a fact worth holding rather than a note in a doc — the live
    /// suite asserts the machine is on it, which is what turns a Codex upgrade into a failing test
    /// rather than a silent protocol drift (ADR-0024, #547).
    static let verifiedAgainst = "0.147.0"
}
