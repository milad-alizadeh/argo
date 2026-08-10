/// A stretch of time as a person says one: `5h 51m`, `51m`, `under a minute`.
///
/// Its own type rather than a helper on the spend projection, and deliberately NOT
/// `SessionAge.phrase`: the roster words how long AGO something happened and rounds to one unit,
/// because a switcher only needs the order explained. A duration is read against another duration —
/// the whole point of showing wall-clock beside worked time is the gap between the two — so it
/// keeps its minutes, and `5h` beside `5h` would hide a ratio the reader is being shown on purpose.
enum ElapsedTime {
    private static let minuteMs = 60 * 1000
    private static let minutesPerHour = 60

    /// Floored, never rounded up: a Session that has run 59 seconds has not run a minute, and the
    /// phrase says so in words rather than claiming one. A negative span is two machines' clocks
    /// disagreeing, not time running backwards, so it floors at zero.
    static func phrase(milliseconds: Int) -> String {
        let minutes = max(milliseconds, 0) / minuteMs
        if minutes == 0 {
            return "under a minute"
        }
        let hours = minutes / minutesPerHour
        let rest = minutes % minutesPerHour
        if hours == 0 {
            return "\(minutes)m"
        }
        return rest == 0 ? "\(hours)h" : "\(hours)h \(rest)m"
    }
}
