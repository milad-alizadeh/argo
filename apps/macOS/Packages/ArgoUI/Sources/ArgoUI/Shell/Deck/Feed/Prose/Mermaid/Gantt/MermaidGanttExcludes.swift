import Foundation

/// The days a Gantt chart says no work happens on: whole weekdays by name, and single dates.
///
/// Whole DAYS and never part of one, which is what `excludes` means in mermaid. So every walk here
/// steps `.day` through `MermaidGanttClock` and none of them subtracts an interval — a day off is
/// a day the calendar names, not a number of seconds taken off a total.
struct MermaidGanttExcludes: Equatable, Sendable {
    /// Gregorian weekday numbers, 1 for Sunday through 7 for Saturday.
    private var weekdays: Set<Int> = []
    /// The first instant of each named day.
    private var days: Set<Date> = []

    var isEmpty: Bool {
        weekdays.isEmpty && days.isEmpty
    }

    /// A chart on which every weekday is a day off. Nothing can ever start on it and no length can
    /// ever run out, so the two walks below give up on it at once rather than stepping for a
    /// century first.
    private var isTotal: Bool {
        weekdays.count == 7
    }

    /// How far a walk LOOKING for a day steps before the source is called unreadable. Nothing
    /// legible is a quarter of a millennium long, and a fence is the honest end of one that is.
    private static let limit = 100_000

    /// And how long a bar may be before it cannot be broken around its days off at all. `runs`
    /// walks a task a day at a time and draws a FIGURE per stretch, so a span of centuries is
    /// hundreds of thousands of rects redrawn every frame — a chart nothing can render rather
    /// than a chart. Fifty-five years is longer than any roadmap and a fifth of the cap above.
    private static let drawLimit = 20000

    /// The names of the weekdays, in the calendar's own order — `firstIndex` + 1 is its number.
    private static let names = [
        "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
    ]

    func excludes(_ instant: Date) -> Bool {
        guard let day = MermaidGanttClock.start(of: .day, at: instant) else { return false }
        return days.contains(day)
            || weekdays.contains(MermaidGanttClock.calendar.component(.weekday, from: day))
    }

    /// One `excludes` line, at the date grammar in force WHERE IT WAS WRITTEN — so a named date
    /// above its own `dateFormat` is read at the default one and fences, while the same two lines
    /// the other way round read fine. Mermaid keeps the words and dates them at the end instead;
    /// this reads them where it meets them, which is how every other line here is read.
    ///
    /// A word neither table knows leaves the whole chart a fence: a day off quietly dropped would
    /// draw every bar after it too short.
    mutating func add(_ text: String, at pattern: String) -> Bool {
        let words = text.split { $0 == "," || $0.isWhitespace }
        guard !words.isEmpty else { return false }
        return words.allSatisfy { take(String($0), at: pattern) }
    }

    private mutating func take(_ word: String, at pattern: String) -> Bool {
        if word.lowercased() == "weekends" {
            weekdays.formUnion([1, 7])
            return true
        }
        if let at = Self.names.firstIndex(of: word.lowercased()) {
            weekdays.insert(at + 1)
            return true
        }
        guard let named = MermaidGanttClock.date(word, at: pattern),
              let day = MermaidGanttClock.start(of: .day, at: named)
        else { return false }
        days.insert(day)
        return true
    }

    /// The first instant at or after `date` that work can happen on, keeping the time of day it
    /// was asked for. `nil` where there is none at all.
    func opening(at date: Date) -> Date? {
        guard !isEmpty else { return date }
        guard !isTotal else { return nil }
        var at = date
        for _ in 0 ..< Self.limit {
            guard excludes(at) else { return at }
            guard let next = Self.day(after: at) else { return nil }
            at = next
        }
        return nil
    }

    /// Where a task of a stated LENGTH really ends: the end it would have had pushed one day
    /// further for every day off it covers, so the days it does cover are the length written.
    ///
    /// An end the source WROTE is never walked — that is a fact about the chart rather than
    /// arithmetic to redo.
    func end(from start: Date, nominally end: Date) -> Date? {
        guard !isEmpty else { return end }
        guard !isTotal else { return nil }
        var end = end
        var at = start
        for _ in 0 ..< Self.limit {
            guard at < end else { return end }
            if excludes(at) {
                guard let pushed = Self.day(after: end) else { return nil }
                end = pushed
            }
            guard let next = Self.day(after: at) else { return nil }
            at = next
        }
        return nil
    }

    /// Whether a task this long can be drawn broken at all. Read at RESOLUTION, so a span past the
    /// cap leaves the block a fence rather than a plan of hundreds of thousands of rects — and a
    /// stated end reaches `runs` without passing the walk cap above, which is the one way a bar
    /// can be longer than anything the length form could ever produce.
    func draws(from start: Date, to end: Date) -> Bool {
        guard !isEmpty else { return true }
        guard let days = MermaidGanttClock.calendar
            .dateComponents([.day], from: start, to: end).day
        else { return false }
        return days <= Self.drawLimit
    }

    /// The stretches of a task that are really drawn: everything between its two ends that is not
    /// a day off. A bar drawn solid across an excluded weekend would say work happens on a day the
    /// chart itself says it cannot — the phantom this epic has been caught by seven times.
    func runs(from start: Date, to end: Date) -> [ClosedRange<Date>] {
        guard !isEmpty, end > start else { return [start ... Swift.max(start, end)] }
        var runs: [ClosedRange<Date>] = []
        for slice in slices(from: start, to: end) where !excludes(slice.lowerBound) {
            if let last = runs.last, last.upperBound == slice.lowerBound {
                runs[runs.count - 1] = last.lowerBound ... slice.upperBound
            } else {
                runs.append(slice)
            }
        }
        // A task every day of which is excluded is still a task the source wrote, so it keeps the
        // mark a zero-length one gets rather than vanishing off its own row.
        return runs.isEmpty ? [start ... start] : runs
    }

    /// Every day the span touches, clipped to its two ends — capped like both its siblings, and
    /// for the same reason. It terminates on the step alone, but terminating is not the same as
    /// being drawable: `draws` has already refused anything that could reach the cap here, so this
    /// is the floor under that rather than a truncation anything is expected to hit.
    private func slices(from start: Date, to end: Date) -> [ClosedRange<Date>] {
        var slices: [ClosedRange<Date>] = []
        var at = MermaidGanttClock.start(of: .day, at: start) ?? start
        for _ in 0 ..< Self.drawLimit {
            guard at < end, let next = Self.day(after: at), next > at else { break }
            slices.append(Swift.max(at, start) ... Swift.min(next, end))
            at = next
        }
        return slices
    }

    private static func day(after date: Date) -> Date? {
        MermaidGanttClock.calendar.date(byAdding: .day, value: 1, to: date)
    }
}
