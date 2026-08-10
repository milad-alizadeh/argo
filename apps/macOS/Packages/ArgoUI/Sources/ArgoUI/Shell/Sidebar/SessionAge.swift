/// How long ago something last happened, as the roster words it.
enum SessionAge {
    private static let minute = 60
    private static let hour = 60 * minute
    private static let day = 24 * hour

    /// A clock reading behind the record it measures is a disagreement between two machines'
    /// seconds, not a Session that ran in the future — hence the floor at zero.
    static func phrase(sinceMs: Int, nowMs: Int) -> String {
        let seconds = max((nowMs - sinceMs) / 1000, 0)
        return switch seconds {
        case ..<minute: "just now"
        case ..<hour: "\(seconds / minute)m ago"
        case ..<day: "\(seconds / hour)h ago"
        default: "\(seconds / day)d ago"
        }
    }
}
