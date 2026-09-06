import Foundation

/// Why a backlog question was not answered.
///
/// **Every failure is one of these, and none of them is an empty answer.** Prose the reader cannot
/// tell from a model's silence is the one outcome this port must never produce: a blank sheet reads
/// as "the backlog has nothing to say", which is a claim about the backlog rather than about Argo
/// (#1315).
enum BacklogAskRefusal: Error, Equatable, Sendable {
    /// No ChatGPT sign-in, so nothing can pay for the answer on included tokens.
    case noSignIn(detail: String)
    /// The `codex` program is not on the user's `PATH`.
    case noCLI(detail: String)
    /// The CLI was still reading when the patience ran out.
    case timedOut(after: Duration)
    /// It exited non-zero, or exited fine and wrote nothing.
    case refused(detail: String)

    /// One sentence, in the reader's words rather than the CLI's, for the surface to draw.
    var sentence: String {
        switch self {
        case let .noSignIn(detail): detail
        case let .noCLI(detail): detail
        case let .timedOut(after): "Codex did not answer within \(after.wholeSeconds) seconds"
        case let .refused(detail): detail
        }
    }
}

/// Reading a `Duration` as a number. Both live here rather than one beside each caller, since the
/// `components` arithmetic is the same and getting it wrong twice is the failure mode.
///
/// Neither is spelled `seconds`: `Duration.seconds(_:)` is the stdlib's own factory, and a property
/// sharing its name reads as one.
extension Duration {
    /// Truncated, for a sentence a reader reads rather than a measurement.
    var wholeSeconds: Int {
        Int(components.seconds)
    }

    /// For a measurement, where the fraction is the point.
    var milliseconds: Int {
        Int(components.seconds * 1000 + components.attoseconds / 1_000_000_000_000_000)
    }
}
