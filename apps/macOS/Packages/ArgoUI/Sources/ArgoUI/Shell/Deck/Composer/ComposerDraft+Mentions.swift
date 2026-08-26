/// What picking a file out of the `@` menu does to the draft (#687, design decision 12).
extension ComposerDraft {
    /// The trailing space closes the menu, so the next ⏎ sends instead of picking a row again.
    /// It stays text and never an `AttachmentChip` — dropping and pasting make those (#540).
    mutating func take(
        mention row: WorkspaceFileProjection.Row,
        replacing range: Range<String.Index>,
    ) {
        text.replaceSubrange(range, with: "@\(row.path) ")
    }
}
