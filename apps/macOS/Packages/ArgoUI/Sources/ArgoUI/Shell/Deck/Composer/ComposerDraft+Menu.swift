/// What picking a row out of a composer menu does to the draft (#685, #687, design decisions 1
/// and 12).
extension ComposerDraft {
    /// The token goes and what the row inserts lands in its place, with a space after it. It
    /// inserts and never sends, so an argument can be typed before ⏎ (`slash-args.png`), and that
    /// space is what closes the menu so the next ⏎ sends instead of picking a row again.
    ///
    /// Everything before the token survives, which is what a mention said mid-sentence needs.
    mutating func take(_ pick: ComposerMenu.Pick) {
        text = pick.taken(over: text)
    }
}
