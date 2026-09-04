import Foundation

/// What the Ask views count as words somebody actually put there.
///
/// Shared by the two readings that ask the question — `FeedAskHeld`, deciding whether a typed
/// `Other` is something to send, and `FeedAsk.answered(_:)`, deciding whether the record came back
/// with prose the folded row can draw (#1207). Both mean the same thing by empty, and a second
/// spelling of it in the same folder is a second thing to keep true.
extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
