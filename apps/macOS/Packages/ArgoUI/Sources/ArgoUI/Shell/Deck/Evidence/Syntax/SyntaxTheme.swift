import HighlightSwift

/// Which colours a patch is read in: Xcode's dark theme, as the dependency ships it.
///
/// Apple's, deliberately, and not a palette of Argo's own. This is the one surface in the cockpit
/// where the reader is looking at SOURCE, and they are already reading the same files in Xcode all
/// day — a keyword that is purple there and something-else here makes the panel a second dialect
/// of a language they already read fluently. Everywhere else in the app the contract's own ramp
/// wins; here, matching the editor beats matching the shell.
///
/// One place decides it, so a second surface that draws code cannot pick a different theme.
enum SyntaxTheme {
    static let colors: HighlightColors = .dark(.xcode)
}
