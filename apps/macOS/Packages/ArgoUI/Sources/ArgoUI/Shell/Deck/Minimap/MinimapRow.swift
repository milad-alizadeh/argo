import Foundation

/// One feed row as the lane needs it (#382): how tall the table measured it, what shape it makes,
/// and the Turn boundaries it carries.
///
/// Deliberately cheap. A reading holds one of these per row and is rebuilt whenever the feed
/// reshapes, so nothing here allocates and nothing here walks a string.
struct MinimapRow: Equatable, Sendable {
    var height: CGFloat
    var shape: MinimapRowShape = .whole(.boundary)
    /// The words this row asked for, where it is a prompt. `nil` on every other row — and a Turn
    /// that opens on a row with none is a promptless exchange, which the lane breaks at exactly
    /// where the feed does.
    var prompt: String?
    /// Whether the Turn running through this row ends at it — the feed's own stop-reason
    /// punctuation, and the interruption that reads the same way.
    var endsTurn = false
}
