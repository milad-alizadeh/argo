import Foundation

// A call's own output → the one line a row shows of it. Nothing is reworded, reordered or
// summarized: these pick a line out of the payload the call printed and hand it on as it was
// written. Which line is a decision; the characters in it never are.

/// How the host opens a failed command's output: `Exit code 1`, alone on the first line. Anchored
/// at both ends, so a line that happens to mention an exit code is not mistaken for one.
private let exitStatusPattern = "^Exit code [0-9]+$"

/// A blank line is not a line of the output — it is the spacing the command printed around one.
private func spoken(_ text: String) -> Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
}

/// The exit line a failed call opened with, or `nil` where the host wrote none.
///
/// The status and nothing else. What went wrong is the whole output's to say and the evidence
/// panel shows the whole output, so no line here is pressed into service as an explanation of a
/// failure it might not explain.
public func commandExitStatus(in output: String) -> String? {
    guard let first = output.split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init)
        .first(where: spoken)
    else {
        return nil
    }
    return first.range(of: exitStatusPattern, options: .regularExpression) == nil ? nil : first
}

/// What a call that SUCCEEDED produced, in one line — its output's last spoken one, verbatim.
///
/// The last line and not a summary of the whole: a command's closing line is where it reports how
/// it went (`Executed 151 tests, with 0 failures`), and counting or paraphrasing what came before
/// it would put Argo's words where the command's are. A selection rule, like the status above.
public func commandOutcome(in output: String) -> String? {
    output.split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init)
        .last(where: spoken)
}
