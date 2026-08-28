import Foundation

/// How long ago a ticket was last touched, as a backlog row stamps it (#897) — one rounded unit,
/// terse enough to sit in the machine caption beside a `#id`.
///
/// Not `AgePhrase`, which words the same distance as prose (`4d ago`, `just now`) for a sentence to
/// carry. A column of seventy-five rows is scanned rather than read, so the stamp drops the `ago`
/// the column already says and gains the two long units a backlog needs and a Session never does.
///
/// It stays RELATIVE all the way out rather than turning into `Aug 12` past a horizon. The reason
/// to look is distance from now; an absolute date hands that subtraction back to the reader, and a
/// column that changes register halfway down loses the rhythm that made it scannable.
enum TicketAge {
    private static let hour = 3600
    private static let day = 24 * hour
    private static let week = 7 * day
    /// A month is 30 days and a year 365 — the stamp is a DISTANCE, not a calendar date, so nothing
    /// here needs the calendar's own arithmetic to be right about which month it is.
    private static let month = 30 * day
    private static let year = 365 * day

    /// A clock reading behind the record it measures is two machines disagreeing about seconds, not
    /// a ticket touched in the future — hence the floor at zero, the same one `AgePhrase` keeps.
    static func stamp(since touched: Date, asOf now: Date) -> String {
        let elapsed = max(Int(now.timeIntervalSince(touched)), 0)
        return switch elapsed {
        case ..<hour: "now"
        case ..<day: "\(elapsed / hour)h"
        case ..<week: "\(elapsed / day)d"
        case ..<month: "\(elapsed / week)w"
        case ..<year: "\(elapsed / month)mo"
        default: "\(elapsed / year)y"
        }
    }
}
