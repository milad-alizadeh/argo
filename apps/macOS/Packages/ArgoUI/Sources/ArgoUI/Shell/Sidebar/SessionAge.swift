/// How long ago something last happened, as the roster words it.
enum SessionAge {
    private static let minute = 60
    private static let hour = 60 * minute
    private static let day = 24 * hour

    /// `ago` is part of the phrase rather than decoration: a bare `2m` beside a Session reads as
    /// how long something took, and what the roster is saying is how long since it happened.
    ///
    /// Every rung floors rather than rounds, so the phrase never claims more time has passed than
    /// has. Under a minute takes a word instead of a number, because `0m ago` is the arithmetic
    /// showing through — and a clock that reads behind the record it is measuring lands there too,
    /// since two machines' seconds are allowed to disagree and `in 3m` would be the roster
    /// claiming the future.
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
