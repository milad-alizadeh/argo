import Foundation

// A Gantt source, read whole or not at all — the same bargain every other reader here strikes. A
// line with no rule below, an unknown date grammar, a date that is not one, a cycle in the `after`
// chain and a day off named in words nobody can date all leave the block a fence (#903, #904).

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
///
/// Its tasks are DRAFTS while it reads, because neither end of one is knowable line by line: an
/// `after` may name an id declared below it, and a length is counted in days an `excludes` further
/// down may still take away. The whole lot is placed at once, by `MermaidGanttResolve`.
private struct MermaidGanttReading {
    private var built = MermaidGantt()
    private var datePattern = MermaidGanttFormat.defaultInput
    private var sections: [(name: String, drafts: [MermaidGanttDraft])] = []

    /// What was read, or `nil` where it is not a chart: a header on its own, a source whose every
    /// section turned out empty, and one whose chains do not resolve. Sections with no task in
    /// them are DROPPED rather than drawn, because a heading over nothing is a row the source
    /// never asked for.
    var chart: MermaidGantt? {
        let filled = sections.filter { !$0.drafts.isEmpty }
        guard !filled.isEmpty,
              let placed = MermaidGanttResolve.tasks(
                  of: filled.flatMap(\.drafts),
                  excluding: built.excludes,
              )
        else { return nil }
        var chart = built
        var rest = placed[...]
        chart.sections = filled.map { section in
            let taken = rest.prefix(section.drafts.count)
            rest = rest.dropFirst(section.drafts.count)
            return MermaidGantt.Section(name: section.name, tasks: Array(taken))
        }
        return chart
    }

    /// One body line. Six rules and no seventh, which is what makes the refusal total:
    /// `tickInterval` and the task states are lines this slice still has no rule for, and each of
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
        if let text = Self.rest(after: "excludes", of: line) {
            return built.excludes.add(text, at: datePattern)
        }
        if let name = Self.rest(after: "section", of: line) {
            sections.append((name: name, drafts: []))
            return true
        }
        return add(task: line)
    }

    /// A task, into the section it was written under — or into an unnamed one, which is where
    /// mermaid puts a task written before the first `section`.
    private mutating func add(task line: String) -> Bool {
        guard let draft = MermaidGanttTask.of(line, at: datePattern) else { return false }
        if sections.isEmpty {
            sections.append((name: "", drafts: []))
        }
        sections[sections.count - 1].drafts.append(draft)
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
