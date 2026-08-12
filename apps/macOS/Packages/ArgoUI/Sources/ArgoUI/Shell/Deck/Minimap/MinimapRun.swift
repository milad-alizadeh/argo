import Foundation

/// One drawn run of a row's miniature: what it says, which of the row's lines it starts on, how
/// many it covers, and how far it reaches across the lane. Two runs may share a line — a mutation's
/// added and removed halves do.
struct MinimapRun: Equatable, Sendable {
    let ink: FeedInk
    /// Which of the row's drawn lines this starts on, counted from the head.
    let line: Int
    /// How many lines it covers. More than one for the shapes the feed draws as a block rather than
    /// as text — a prompt's bubble, a picture's frame.
    var lines = 1
    /// Where it runs, as shares of the drawable width — prose keeps the leading edge and a
    /// prompt's bubble the trailing one, as in the feed.
    let span: ClosedRange<CGFloat>
}
