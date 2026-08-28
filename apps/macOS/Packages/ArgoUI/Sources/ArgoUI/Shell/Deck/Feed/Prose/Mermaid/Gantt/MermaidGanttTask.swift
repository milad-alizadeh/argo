import Foundation

/// One task row: `Name : [id,] start, end-or-duration`.
///
/// The two absolute forms are all of this slice. `after <id>` is not a date, and a state keyword is
/// not an id, so both come back `nil` and leave the block a fence — a bar drawn at the wrong date
/// or a milestone drawn as a bar would each be a wrong chart, which is worse than none (#903).
enum MermaidGanttTask {
    /// What #905 draws distinctly and this slice must not silently draw as an ordinary bar. Read
    /// as an id they would each place a task correctly and colour it wrong; `milestone` would
    /// place a marker as a bar spanning nothing.
    private static let states: Set<String> = ["done", "active", "crit", "milestone"]

    static func of(_ line: String, at pattern: String) -> MermaidGantt.Task? {
        guard let colon = line.firstIndex(of: ":") else { return nil }
        let name = line[..<colon].trimmingCharacters(in: .whitespaces)
        let fields = line[line.index(after: colon)...]
            .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard !name.isEmpty, fields.count == 2 || fields.count == 3 else { return nil }
        guard let id = id(of: fields.dropLast(2)),
              let start = MermaidGanttClock.date(fields[fields.count - 2], at: pattern),
              let end = end(fields[fields.count - 1], from: start, at: pattern),
              end >= start
        else { return nil }
        return MermaidGantt.Task(name: name, id: id, start: start, end: end)
    }

    /// The handle in front of the dates, or `""` where there is none. Anything that is not a bare
    /// identifier — and any of the state keywords, which are — is refused.
    private static func id(of fields: ArraySlice<String>) -> String? {
        guard let written = fields.first else { return "" }
        guard !written.isEmpty, !states.contains(written.lowercased()),
              written.allSatisfy(MermaidScan.isIdentifier)
        else { return nil }
        return written
    }

    /// Where the bar stops: a second date, or a length added to the first. Added through the
    /// calendar and never to a count of seconds, so a week is a week across a clock change.
    private static func end(_ text: String, from start: Date, at pattern: String) -> Date? {
        if let date = MermaidGanttClock.date(text, at: pattern) {
            return date
        }
        guard let length = duration(text) else { return nil }
        return MermaidGanttClock.calendar.date(byAdding: length, to: start)
    }

    /// `30d`, `2w`, `6h`, `1M`. A count and one of dayjs' units — mermaid's own — as the components
    /// the calendar adds, never a multiplication into seconds. Case matters, exactly as it does
    /// there: `m` is a minute and `M` a month.
    private static func duration(_ text: String) -> DateComponents? {
        let digits = text.prefix { $0.isNumber }
        guard let count = Int(digits) else { return nil }
        switch String(text.dropFirst(digits.count)) {
        case "ms": return DateComponents(nanosecond: count * 1_000_000)
        case "s": return DateComponents(second: count)
        case "m": return DateComponents(minute: count)
        case "h": return DateComponents(hour: count)
        case "d": return DateComponents(day: count)
        case "w": return DateComponents(weekOfYear: count)
        case "M": return DateComponents(month: count)
        case "y": return DateComponents(year: count)
        default: return nil
        }
    }
}
