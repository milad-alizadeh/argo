import Foundation

// A failed call's output → the two things a row shows about it. Nothing is reworded, reordered or
// summarized: this picks lines out of the payload the call printed and hands them on as they were
// written.

/// How the host opens a failed command's output: `Exit code 1`, alone on the first line. Anchored
/// at both ends, so a diagnostic that happens to mention an exit code is not mistaken for one.
private let exitStatusPattern = "^Exit code [0-9]+$"

/// A blank line is not a line of the failure — it is the spacing the command printed around one.
private func spoken(_ text: String) -> Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
}

/// What a failed call's output says about itself.
///
/// The first spoken line is the whole judgement: where the host wrote its exit line, the failure's
/// own words are the line after it; where it did not, the first line IS them. A command that
/// printed nothing but its status has no diagnostic, and the row says only what exit it took —
/// which is honest where a nearby line pressed into service as an explanation is not.
public func commandFailure(in output: String) -> CommandFailure {
    let lines = output.split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init)
        .filter(spoken)
    guard let first = lines.first else {
        return CommandFailure(status: nil, diagnostic: nil)
    }
    guard first.range(of: exitStatusPattern, options: .regularExpression) != nil else {
        return CommandFailure(status: nil, diagnostic: first)
    }
    return CommandFailure(status: first, diagnostic: lines.dropFirst().first)
}
