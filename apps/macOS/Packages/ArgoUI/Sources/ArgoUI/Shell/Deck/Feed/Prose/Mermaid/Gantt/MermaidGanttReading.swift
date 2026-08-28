import Foundation

// A Gantt source, read whole or not at all — the same bargain every other reader here strikes. A
// line with no rule below, an unknown date grammar and a date that is not one all leave the block
// the fence it is today (#903).

extension MermaidGantt {
    /// The Gantt chart this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidGantt? {
        var lines = MermaidSource.lines(of: source)
        guard let header = lines.first, header.lowercased() == "gantt" else { return nil }
        lines.removeFirst()
        var reading = MermaidGanttReading()
        for line in lines {
            guard reading.add(line) else { return nil }
        }
        return reading.chart
    }
}

/// A Gantt chart part-read: what has been said so far, and the date grammar the lines after a
/// `dateFormat` are read at.
///
/// Its own type because that grammar is READING state and not a fact about the chart — a task
/// keeps the date it was read as, never the spelling it arrived in.
private struct MermaidGanttReading {
    private var built = MermaidGantt()
    private var datePattern = MermaidGanttFormat.defaultInput

    /// What was read, or `nil` where it is not a chart: a header on its own, and a source whose
    /// every section turned out empty. Sections with no task in them are DROPPED rather than
    /// drawn, because a heading over nothing is a row the source never asked for.
    var chart: MermaidGantt? {
        var chart = built
        chart.sections = built.sections.filter { !$0.tasks.isEmpty }
        return chart.sections.isEmpty ? nil : chart
    }

    /// One body line. Five rules and no sixth, which is what makes the refusal total: `excludes`,
    /// `tickInterval` and the task states are all lines this slice has no rule for, and each of
    /// them leaves the whole chart a fence rather than a chart missing what they said.
    mutating func add(_ line: String) -> Bool {
        if let text = Self.rest(after: "title", of: line) {
            built.title = text
            return true
        }
        if let text = Self.rest(after: "dateFormat", of: line) {
            guard let pattern = MermaidGanttFormat.input(text) else { return false }
            datePattern = pattern
            return true
        }
        if let text = Self.rest(after: "axisFormat", of: line) {
            guard let pattern = MermaidGanttFormat.axis(text) else { return false }
            built.axisPattern = pattern
            return true
        }
        if let name = Self.rest(after: "section", of: line) {
            built.sections.append(MermaidGantt.Section(name: name))
            return true
        }
        return add(task: line)
    }

    /// A task, into the section it was written under — or into an unnamed one, which is where
    /// mermaid puts a task written before the first `section`.
    private mutating func add(task line: String) -> Bool {
        guard let task = MermaidGanttTask.of(line, at: datePattern) else { return false }
        if built.sections.isEmpty {
            built.sections.append(MermaidGantt.Section(name: ""))
        }
        built.sections[built.sections.count - 1].tasks.append(task)
        return true
    }

    /// The words after `keyword`, or `nil` where this line does not open with it. Matched as a
    /// WORD and never as a prefix, so a task called `sections of the epic` is never read as one —
    /// and never with nothing after it, because a keyword naming nothing is a line half written.
    private static func rest(after keyword: String, of line: String) -> String? {
        guard line.prefix(keyword.count).lowercased() == keyword.lowercased() else { return nil }
        let after = line.dropFirst(keyword.count)
        guard after.first?.isWhitespace == true else { return nil }
        let rest = after.trimmingCharacters(in: .whitespaces)
        return rest.isEmpty ? nil : rest
    }
}
