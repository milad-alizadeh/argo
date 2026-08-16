/// What picking a file out of the `@` menu does to the draft (#687, design decision 12).
extension ComposerDraft {
    /// Put the whole path where the `@` token was, with a space after it, and leave the rest of
    /// the line alone. A mention is said mid-sentence, so this replaces the TOKEN rather than the
    /// line the way `take(_ command:)` does.
    ///
    /// The trailing space is what closes the menu: the token is settled, so the next ⏎ sends the
    /// Turn instead of picking a row again.
    ///
    /// It stays TEXT, and never an `AttachmentChip`. Dropping and pasting make chips (#540) —
    /// a different act with a different result — and `claude` reads this as its own mention while
    /// `codex` reads a path its agent can open. One line, both adapters.
    mutating func take(
        mention row: WorkspaceFileProjection.Row,
        replacing range: Range<String.Index>,
    ) {
        text.replaceSubrange(range, with: "@\(row.path) ")
    }
}
