/// What picking a row out of the `/` menu does to the draft (#685, design decision 1).
extension ComposerDraft {
    /// Put the command in the field with a space after it, and nothing else. It inserts and never
    /// sends, so an argument can be typed before ⏎ (`slash-args.png`).
    ///
    /// Replacing the whole line is safe because the menu only opens on a line that is a `/` and a
    /// run of non-space: the typed fragment IS the line.
    mutating func take(_ command: String) {
        text = "\(command) "
    }
}
