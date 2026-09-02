import Foundation

/// The calendar a Gantt chart is read, stepped and labelled by.
///
/// Fixed to the Gregorian calendar, UTC and `en_US_POSIX`, and never the machine's own. A chart is
/// a picture of what the source wrote: read on the reader's locale it would start a week on a
/// different day, spell a month in a different language and shift every bar by whatever the
/// machine's zone is — three ways for one fence to draw differently on two Macs.
enum MermaidGanttClock {
    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US_POSIX")
        guard let utc = TimeZone(secondsFromGMT: 0) else { return calendar }
        calendar.timeZone = utc
        return calendar
    }()

    /// A date read at `pattern`, or `nil` where the words are not one — which is what leaves a
    /// chart a fence rather than placing a bar at a date nobody wrote.
    ///
    /// Read and then WRITTEN BACK, because `DateFormatter` refuses a month out of range and rolls
    /// a DAY: `2026-02-30` comes back as the 2nd of March and `2026-04-31` as the 1st of May. A bar
    /// starting on a day the source did not write is the phantom this epic keeps being caught on,
    /// so the only date accepted is one the same formatter spells the same way round again.
    static func date(_ text: String, at pattern: String) -> Date? {
        let formatter = formatter(pattern)
        guard let read = formatter.date(from: text), formatter.string(from: read) == text
        else { return nil }
        return read
    }

    static func words(of date: Date, at pattern: String) -> String {
        formatter(pattern).string(from: date)
    }

    /// The start of the `unit` `date` falls in — a month's first instant, a week's, a day's. The
    /// calendar's own answer, because "the Monday of this week" is not arithmetic on a number of
    /// seconds.
    static func start(of unit: Calendar.Component, at date: Date) -> Date? {
        calendar.dateInterval(of: unit, for: date)?.start
    }

    /// A formatter built per call rather than held: a chart asks for one per pattern and a handful
    /// of ticks, and a shared mutable `DateFormatter` is the one thing here that is not `Sendable`.
    private static func formatter(_ pattern: String) -> DateFormatter {
        let made = DateFormatter()
        made.calendar = calendar
        made.locale = calendar.locale
        made.timeZone = calendar.timeZone
        made.dateFormat = pattern
        return made
    }
}
