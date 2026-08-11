import Foundation

/// A command as the FEED says it: what was run, without the plumbing that carried its output and
/// without the preamble that got the shell into position.
///
/// Both ends are real and both survive whole in the panel's header; only this line drops them.
///
/// It cuts and never rewrites: every character shown is the agent's own, in its own order, and an
/// ellipsis says something was left behind — in front where the preamble was, behind where the
/// plumbing was, and inside a path where the middle of it was.
enum FeedCommandLine {
    static func head(of command: String) -> String {
        let whole = command.trimmingCharacters(in: .whitespacesAndNewlines)
        let work = withoutPreamble(whole)
        let ran = beforePipe(work)
            .replacingOccurrences(of: redirection, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        return marked(
            elidingLongPaths(in: ran),
            preambled: work.count != whole.count,
            plumbed: ran.count != work.count,
        )
    }

    /// Everything up to the pipe that carried the output away.
    ///
    /// Two `|` are not one. A `;`, `&&` or `||` chain is left alone: those are separate commands,
    /// and dropping them would hide something that RAN rather than something that redirected. Nor
    /// is a `|` inside quotes — `jq '.result | keys'` is one argument, and cutting there draws a
    /// command the agent never wrote. Both are why the pipe is scanned for rather than split on.
    private static func beforePipe(_ command: String) -> String {
        let characters = Array(command)
        var quote: Character?
        for index in characters.indices {
            let character = characters[index]
            if let open = quote {
                quote = character == open ? nil : open
            } else if character == "'" || character == "\"" {
                quote = character
            } else if character == "|", isAlone(characters, at: index) {
                return String(characters[..<index])
            }
        }
        return command
    }

    /// Whether this `|` is a pipe rather than half of a `||`.
    private static func isAlone(_ characters: [Character], at index: Int) -> Bool {
        (index == characters.startIndex || characters[index - 1] != "|")
            && (index == characters.count - 1 || characters[index + 1] != "|")
    }

    /// What the shell was told before it was told to do anything.
    ///
    /// `VAR=value` sets the environment and `cd … &&` sets the directory; neither is work, and both
    /// sit exactly where the verb should be. Dropped in a loop because they interleave — a `cd`
    /// prelude can be followed by an assignment, and either can be followed by the other.
    private static func withoutPreamble(_ command: String) -> String {
        var command = command
        while true {
            let shorter = [assignments, changeOfDirectory].reduce(command) {
                $0.replacingOccurrences(of: $1, with: "", options: .regularExpression)
            }
            if shorter.count == command.count {
                return command
            }
            command = shorter
        }
    }

    /// Every path in the command that is too long to draw, cut in its middle by the shared rule.
    ///
    /// The run is taken from the first separator forward, so what precedes it — a flag, a `f=`, the
    /// first segment of a relative path — survives whole and the cut falls in the address itself.
    private static func elidingLongPaths(in command: String) -> String {
        command.split(separator: " ", omittingEmptySubsequences: false)
            .map(elidingPath)
            .joined(separator: " ")
    }

    private static func elidingPath(in word: Substring) -> String {
        guard let separator = word.firstIndex(of: "/") else { return String(word) }
        let address = DeckMiddleCut.applied(to: String(word[separator...]))
        return String(word[..<separator]) + address
    }

    /// The ellipses, on whichever ends something was left behind. A command that needed no cut is
    /// drawn whole and carries none, which is what makes one on a drawn command mean anything.
    private static func marked(_ command: String, preambled: Bool, plumbed: Bool) -> String {
        (preambled ? "… " : "") + command + (plumbed ? " …" : "")
    }

    /// One or more leading `VAR=value` assignments, quoted or bare.
    private static let assignments = #"^([A-Za-z_][A-Za-z0-9_]*=("[^"]*"|'[^']*'|\S*)\s+)+"#

    /// A leading `cd … &&` prelude. Anchored at the front and required to end in the chain
    /// operator, so a `cd` the agent ran on its own is a command like any other and stays drawn.
    private static let changeOfDirectory = #"^cd\s+("[^"]*"|'[^']*'|\S+)\s*&&\s*"#

    /// A trailing redirection — `2>&1`, `> out.log`, `>> log`. Anchored at the end, so a `>` inside
    /// the command's own arguments is not mistaken for one.
    private static let redirection = #"\s*(\d?>&\d|&?>>?\s*\S+)\s*$"#
}
