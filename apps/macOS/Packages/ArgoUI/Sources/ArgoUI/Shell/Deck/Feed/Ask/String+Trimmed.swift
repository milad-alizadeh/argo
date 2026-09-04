import Foundation

/// Shared by `FeedAskHeld`, deciding whether a typed `Other` is something to send, and
/// `FeedAsk.answered(_:)`, deciding whether the record came back with prose the settled row can
/// draw. Both mean the same thing by empty (#1207).
extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
