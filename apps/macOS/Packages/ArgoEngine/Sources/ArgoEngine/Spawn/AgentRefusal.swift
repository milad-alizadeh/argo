import Foundation

/// The sentence a refusal to start, continue or hand over a Session reads as.
///
/// Four errors reach the app's one alert — the spawn's, the resume's, the handoff's, and whatever
/// else fell out — and each of the first three already words itself. The mapping was written out at
/// every call site, which is three places for a new error type to start reading as
/// `localizedDescription` and nobody to notice: the alert still says something, and what it says is
/// a Foundation sentence about a file handle.
///
/// Here instead, so it is one decision with a test on it rather than three copies in a target no
/// test can reach (ADR-0022).
public enum AgentRefusal {
    /// What to put under the alert's title. Argo's own sentence where the error carries one, and
    /// the system's only where nothing else does.
    public static func detail(of error: any Error) -> String {
        switch error {
        case let failure as AgentSpawnError: failure.detail
        case let failure as SessionResumeError: failure.detail
        case let failure as SessionHandoff.Failure: failure.detail
        default: error.localizedDescription
        }
    }
}
