import Foundation

/// Whether a command only LOOKED, read from the command text and nothing else.
///
/// A closed allowlist, everything else loud. The default is what keeps the fold safe: anything
/// unrecognised — a chained line, a redirection with a file behind it — is simply not folded, so
/// the worst cost is a noisier feed, never a folded-away `git push`.
///
/// Not quote-aware: a quoted `&&` or `|` makes the line unrecognised, which leans the way the
/// refusal already leans.
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
        // A wrapper is judged by what it WRAPPED: the allowlist is re-applied to the tail, so
        // `rtk git push` reaches `git push` and is refused there.
        let spoken = Array(words.drop(while: wrappers.contains))
        guard let verb = spoken.first else { return false }
        guard let grammar = subcommands[verb] else { return looking.contains(verb) }
        return spoken.count > grammar.at && grammar.looking.contains(spoken[grammar.at])
    }

    /// Whether one word could not, on its own, have changed something.
    ///
    /// Two ways it could. A redirection with a target WRITES the file it names — `cat a > b` is a
    /// copy however read-only `cat` is — so only a bare descriptor duplication (`2>&1`) survives.
    /// And `find` carries its own primaries for running a command and writing a file, neither
    /// visible as a shell operator.
    private static func isHarmless(_ word: String) -> Bool {
        guard !mutatingPrimaries.contains(word) else { return false }
        guard word.contains(">") || word.contains("<") else { return true }
        return word.range(of: descriptor, options: .regularExpression) != nil
    }

    /// Anything that puts a second command on the line, whether or not it ran.
    private static let chains = ["&&", "||", ";", "`", "$("]

    /// Commands that can only look, whatever their arguments say.
    private static let looking: Set<String> = [
        "ls", "cat", "head", "tail", "wc", "find", "grep", "rg",
    ]

    /// A command whose verb sits further along, at a position fixed by that tool's grammar
    /// (`git status`, `gh issue view`). Anything the position does not fit — a global flag
    /// included — is unrecognised.
    private static let subcommands: [String: (at: Int, looking: Set<String>)] = [
        "git": (at: 1, looking: ["log", "status", "diff", "show"]),
        "gh": (at: 2, looking: ["view", "list"]),
    ]

    /// Commands that carry another command's output and nothing of their own.
    private static let wrappers: Set<String> = ["rtk"]

    /// `find`'s own verbs for running a command and for writing a file. Named as words rather than
    /// guarded per command, so a future entry on the allowlist cannot smuggle one of them back in.
    private static let mutatingPrimaries: Set<String> = [
        "-exec", "-execdir", "-ok", "-okdir", "-delete",
        "-fprint", "-fprint0", "-fprintf", "-fls",
    ]

    /// A descriptor duplication and nothing else — `2>&1`, `>&2`. A `>` with a filename after it
    /// is a write and never matches.
    private static let descriptor = #"^\d?>&\d$"#
}
