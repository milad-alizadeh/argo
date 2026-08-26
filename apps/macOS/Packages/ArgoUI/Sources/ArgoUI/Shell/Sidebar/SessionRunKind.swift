/// What KIND of run a Session is, taken off the words it opened with (#745).
///
/// It reads on the roster's secondary line and not in the title, because the roster column is
/// narrow and truncates at the tail: a `/implement` in front of every title spends the scarce
/// leading characters on the one word every row repeats.
enum SessionRunKind {
    /// The slash command a derived title opened with, verbatim: `/implement 745` reads as
    /// `/implement`. `nil` for a title that is not a command, which is every Session whose first
    /// prompt was prose.
    ///
    /// Verbatim rather than prettified: the command IS what was typed, and a `/code-review` set as
    /// `Code review` is Argo re-wording a fact it was handed.
    static func command(inDerivedTitle title: String) -> String? {
        guard title.hasPrefix("/") else { return nil }
        let command = title.prefix { !$0.isWhitespace }
        return command.count > 1 ? String(command) : nil
    }
}
