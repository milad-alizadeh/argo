import Foundation

/// A command as the FEED says it: what was run, without the plumbing that carried its output.
///
/// `bun run test 2>&1 | grep -E "Test run with" | head -20` is one useful phrase followed by two
/// clauses about where the text went. The pipeline is real and it is kept — the panel's header
/// shows the command whole — but on a line whose whole job is to say what happened, the tail is the
/// part that pushes the verb off the screen.
///
/// It cuts and never rewrites: every character shown is the agent's own, in its own order, and an
/// ellipsis says something was left behind.
enum FeedCommandLine {
    static func head(of command: String) -> String {
        let whole = command.trimmingCharacters(in: .whitespacesAndNewlines)
        // A `;` or `&&` chain is left alone: those are separate commands, and dropping them would
        // hide something that RAN rather than something that redirected.
        let piped = whole.split(separator: "|", maxSplits: 1, omittingEmptySubsequences: false)
        let head = String(piped[0])
            .replacingOccurrences(of: redirection, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        return head.count == whole.count ? whole : "\(head) …"
    }

    /// A trailing redirection — `2>&1`, `> out.log`, `>> log`. Anchored at the end, so a `>` inside
    /// the command's own arguments is not mistaken for one.
    private static let redirection = #"\s*(\d?>&\d|&?>>?\s*\S+)\s*$"#
}
