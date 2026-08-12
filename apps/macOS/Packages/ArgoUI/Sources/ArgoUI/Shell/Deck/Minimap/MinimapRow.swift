import Foundation

/// One feed row as the lane needs it (#382): how tall it stands, the runs it is drawn as, and the
/// Turn boundaries it carries.
///
/// The height is the table's own measurement and nothing else. Everything derived here — how many
/// bars a paragraph makes, how full the last one is — is derived FROM that height, so a row's place
/// in the lane is never a guess about where the reading put it.
struct MinimapRow: Equatable, Sendable {
    var height: CGFloat
    var runs: [MinimapRun] = []
    /// The words this row asked for, where it is a prompt. `nil` on every other row — and a Turn
    /// that opens on a row with none is a promptless exchange, which the lane breaks at exactly
    /// where the feed does.
    var prompt: String?
    /// Whether the Turn running through this row ends at it — the feed's own stop-reason
    /// punctuation, and the interruption that reads the same way.
    var endsTurn = false

    /// How many lines the row is drawn as. Read off the runs rather than stored beside them, so the
    /// two can never disagree about how tall a slot is.
    var lines: Int {
        (runs.map(\.line).max() ?? 0) + 1
    }
}
