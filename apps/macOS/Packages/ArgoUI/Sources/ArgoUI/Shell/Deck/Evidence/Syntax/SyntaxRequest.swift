import ArgoEngine

/// What a surface asks the grammar to read — characters and all.
///
/// **The characters are IN the request, so its equality is theirs.** A stack recycles a row view by
/// its POSITION: the row that drew file A's line 4 draws file B's line 4 next, with A's colours
/// still in its state. A request keyed on anything less than the text — a position, a language, a
/// start line, a line count — compares equal across two different files and hands one file's
/// colours to another file's words.
///
/// `SyntaxColouring.over(_:)` is the only way to reach colours, which is what enforces it (#754).
enum SyntaxRequest: Equatable, Sendable {
    /// A file, or a run of one — every line coloured under a single parse of the whole, never a
    /// line at a time (`SyntaxHighlight` says why).
    case source(lines: [String], under: EvidenceLanguage)
    /// A patch, whose two sides are two programs (`SyntaxPatch` says why). No language is a path
    /// whose extension Argo does not know: the patch is then drawn in one ink.
    case patch(lines: [DiffLine], under: EvidenceLanguage?)
    /// One fenced block, drawn as a single run of text rather than a row per line. No language is
    /// a fence with no info string, or one naming a grammar Argo cannot read.
    case block(code: String, under: EvidenceLanguage?)
}
