/// What picking a row out of the `/` menu does to the draft (#685, design decision 1).
extension ComposerDraft {
    /// Put the command in the field with a space after it, and nothing else.
    ///
    /// **It inserts; it never sends.** A command with arguments is the common case, and sending on
    /// ⏎ would make the argument impossible to type — so the trailing space is the caret's landing
    /// place and the composer stays sendable throughout (`slash-args.png`).
    ///
    /// The whole line is replaced rather than the typed fragment patched, because the menu only
    /// opens at the head of a line with no space in it: the fragment IS the line.
    mutating func take(_ command: String) {
        text = "\(command) "
    }
}
