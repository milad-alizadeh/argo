import Foundation

/// Whether a command only LOOKED, read from the command text and nothing else.
///
/// A closed allowlist, and everything else loud. The default is what makes the fold safe: an
/// unrecognised command, a chained line, a redirection with a file behind it — none of them are
/// inspected further, they are simply not folded. The worst this can cost is a feed noisier than it
/// could be, never one that folded away a `git push`.
///
/// A total function of the text with an explicit refusal, exactly as the tool-kind reading refuses
/// to `other` rather than guessing the nearest kind. Nothing here is quote-aware on purpose: a
/// quoted `&&` or `|` makes the line unrecognised, which is the direction the refusal already
/// leans, and a scanner that got the quoting subtly wrong would lean the other way.
///
/// It reads the command rather than the agent's narration, so it works on a Codex Session too.
enum FeedQuietCommand {
    static func onlyLooks(at command: String) -> Bool {
        let line = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !line.isEmpty, !line.contains(where: \.isNewline),
              chains.allSatisfy({ !line.contains($0) })
        else { return false }
        // `||` is a chain and is already gone, so what is left of a `|` is a pipeline — quiet only
        // if EVERY stage of it is. `ls | xargs rm` is the shape this is for.
        return line.components(separatedBy: "|").allSatisfy(reads)
    }

    /// One stage of a pipeline: its words must all be harmless, and its verb must be named.
    private static func reads(_ stage: String) -> Bool {
        let words = stage.split(separator: " ").map(String.init)
        guard words.allSatisfy(isHarmless) else { return false }
        // A wrapper is judged by what it wrapped: `rtk` filters another command's output and
        // carries none of its own, so smuggling anything through it is impossible by construction.
        let spoken = Array(words.drop(while: wrappers.contains))
        guard let verb = spoken.first else { return false }
        guard let grammar = subcommands[verb] else { return looking.contains(verb) }
        return spoken.count > grammar.at && grammar.looking.contains(spoken[grammar.at])
    }

    /// Whether one word could not, on its own, have changed something.
    ///
    /// Two ways it could. A redirection with a target WRITES the file it names, and `cat a > b` is
    /// a copy however read-only `cat` is; only a bare descriptor duplication (`2>&1`) survives.
    /// And `find` carries its own way to run anything at all, which is a shell inside an allowed
    /// command rather than an argument to it.
    private static func isHarmless(_ word: String) -> Bool {
        guard !runsSomethingElse.contains(word) else { return false }
        guard word.contains(">") || word.contains("<") else { return true }
        return word.range(of: descriptor, options: .regularExpression) != nil
    }

    /// Anything that puts a second command on the line, whether or not it ran.
    private static let chains = ["&&", "||", ";", "`", "$("]

    /// Commands that can only look, whatever their arguments say.
    private static let looking: Set<String> = [
        "ls", "cat", "head", "tail", "wc", "find", "grep", "rg",
    ]

    /// A command whose first word says nothing on its own — the verb sits further along, at a
    /// position that is part of that tool's own grammar (`git status`, `gh issue view`). A shape
    /// the position does not fit, a global flag included, is unrecognised like anything else.
    private static let subcommands: [String: (at: Int, looking: Set<String>)] = [
        "git": (at: 1, looking: ["log", "status", "diff", "show"]),
        "gh": (at: 2, looking: ["view", "list"]),
    ]

    /// Commands that carry another command's output and nothing of their own.
    private static let wrappers: Set<String> = ["rtk"]

    private static let runsSomethingElse: Set<String> = [
        "-exec", "-execdir", "-ok", "-okdir", "-delete",
    ]

    /// A descriptor duplication and nothing else — `2>&1`, `>&2`. A `>` with a filename after it
    /// is a write and never matches.
    private static let descriptor = #"^\d?>&\d$"#
}
