import Foundation

/// Why a backlog question was not answered.
///
/// **Every failure is one of these, and none of them is an empty answer.** Prose the reader cannot
/// tell from a model's silence is the one outcome this port must never produce: a blank sheet reads
/// as "the backlog has nothing to say", which is a claim about the backlog rather than about Argo
/// (#1315).
public enum BacklogAskRefusal: Error, Equatable, Sendable {
    /// No ChatGPT sign-in, so nothing can pay for the answer on included tokens.
    case noSignIn(detail: String)
    /// The `codex` program is not on the user's `PATH`.
    case noCLI(detail: String)
    /// The CLI was still reading when the patience ran out.
    case timedOut(after: Duration)
    /// It exited non-zero, or exited fine and wrote nothing.
    case refused(detail: String)

    /// One sentence, in the reader's words rather than the CLI's, for the surface to draw.
    public var sentence: String {
        switch self {
        case let .noSignIn(detail): detail
        case let .noCLI(detail): detail
        case let .timedOut(after): "Codex did not answer within \(after.seconds) seconds"
        case let .refused(detail): detail
        }
    }
}

extension Duration {
    /// Whole seconds, for a sentence a reader reads rather than a measurement.
    var seconds: Int {
        Int(components.seconds)
    }
}
