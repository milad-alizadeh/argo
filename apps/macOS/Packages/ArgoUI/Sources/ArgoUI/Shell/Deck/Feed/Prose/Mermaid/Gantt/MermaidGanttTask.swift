import Foundation

/// One task row as the source WROTE it: `Name : [id,] start-or-after, end-or-duration`.
///
/// Not yet a `MermaidGantt.Task`, because neither of its ends is knowable line by line — `after`
/// may name an id declared below, and a length is counted in days the chart's `excludes` has not
/// been read yet either. `MermaidGanttResolve` turns a whole chart's worth of these into bars.
struct MermaidGanttDraft: Equatable, Sendable {
    let name: String
    /// The handle the source gave it, empty where it gave none.
    let id: String
    let begin: Begin
    let length: Length

    /// Where the bar opens: a date, or the tasks it waits for.
    enum Begin: Equatable, Sendable {
        case on(Date)
        case after([String])
    }

    /// Where it closes: a date the source stated, or a length to count out from the start.
    enum Length: Equatable, Sendable {
        case until(Date)
        case lasting(DateComponents)
    }
}

enum MermaidGanttTask {
    /// What #905 draws distinctly and this slice must not silently draw as an ordinary bar. Read
    /// as an id they would each place a task correctly and colour it wrong; `milestone` would
    /// place a marker as a bar spanning nothing.
    private static let states: Set<String> = ["done", "active", "crit", "milestone"]

    static func of(_ line: String, at pattern: String) -> MermaidGanttDraft? {
        guard let colon = line.firstIndex(of: ":") else { return nil }
        let name = line[..<colon].trimmingCharacters(in: .whitespaces)
        let fields = line[line.index(after: colon)...]
            .split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        guard !name.isEmpty, fields.count == 2 || fields.count == 3 else { return nil }
        guard let id = id(of: fields.dropLast(2)),
              let begin = begin(fields[fields.count - 2], at: pattern),
              let length = length(fields[fields.count - 1], at: pattern)
        else { return nil }
        return MermaidGanttDraft(name: name, id: id, begin: begin, length: length)
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

    private static func begin(_ text: String, at pattern: String) -> MermaidGanttDraft.Begin? {
        if let date = MermaidGanttClock.date(text, at: pattern) {
            return .on(date)
        }
        return waits(on: text).map { .after($0) }
    }

    /// The ids an `after` names — mermaid takes several, and a task named after several waits for
    /// the last of them. `nil` for anything that is not an `after` at all, and for one naming
    /// something that is not an identifier, which no task could ever answer to.
    private static func waits(on text: String) -> [String]? {
        guard text.prefix(5).lowercased() == "after" else { return nil }
        let rest = text.dropFirst(5)
        guard rest.first?.isWhitespace == true else { return nil }
        let ids = rest.split(whereSeparator: \.isWhitespace).map(String.init)
        guard !ids.isEmpty, ids.allSatisfy({ $0.allSatisfy(MermaidScan.isIdentifier) })
        else { return nil }
        return ids
    }

    /// Where the bar stops: a second date, or a length to count out from wherever it opens.
    private static func length(_ text: String, at pattern: String) -> MermaidGanttDraft.Length? {
        if let date = MermaidGanttClock.date(text, at: pattern) {
            return .until(date)
        }
        return duration(text).map { .lasting($0) }
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
