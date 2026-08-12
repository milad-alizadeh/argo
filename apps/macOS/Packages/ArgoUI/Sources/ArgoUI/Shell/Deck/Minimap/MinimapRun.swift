import Foundation

/// One drawn run of a row's miniature: what it says, which of the row's lines it sits on, and how
/// far it reaches across the lane.
///
/// Two runs share a line where one row says two things at once — a mutation's added and removed
/// halves, which the row itself draws side by side at the end of its sentence.
struct MinimapRun: Equatable, Sendable {
    let ink: MinimapInk
    /// Which of the row's drawn lines this sits on, counted from the head.
    let line: Int
    /// Where it runs, as shares of the drawable width. The feed's own alignment shrunk: prose keeps
    /// the leading edge and a prompt's bubble keeps the trailing one, so the lane says who spoke
    /// before any colour is read.
    let span: ClosedRange<CGFloat>
}
