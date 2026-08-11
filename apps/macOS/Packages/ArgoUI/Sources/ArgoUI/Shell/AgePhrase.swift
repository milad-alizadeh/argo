/// How long ago something last happened, in one rounded unit.
///
/// Shared rather than per-surface: the roster words how long ago a Session was seen and the
/// connection chip words how long ago a read landed, and two spellings of "4m ago" is how one app
/// starts reading as two.
enum AgePhrase {
    private static let minute = 60
    private static let hour = 60 * minute
    private static let day = 24 * hour

    /// A clock reading behind the record it measures is a disagreement between two machines'
    /// seconds, not a Session that ran in the future — hence the floor at zero.
    static func phrase(sinceMs: Int, nowMs: Int) -> String {
        phrase(seconds: (nowMs - sinceMs) / 1000)
    }

    static func phrase(seconds: Int) -> String {
        let elapsed = max(seconds, 0)
        return switch elapsed {
        case ..<minute: "just now"
        case ..<hour: "\(elapsed / minute)m ago"
        case ..<day: "\(elapsed / hour)h ago"
        default: "\(elapsed / day)d ago"
        }
    }
}
