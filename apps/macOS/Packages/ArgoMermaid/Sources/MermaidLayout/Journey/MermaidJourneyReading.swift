import Foundation

// A journey's source, read whole or not at all.
//
// The half that matters is the `nil`, exactly as it is for every reader beside it: a line this
// reader has no rule for — a score off mermaid's scale, a row still streaming in — leaves the
// block the fence it is today (#859).

extension MermaidJourney {
    /// The journey this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidJourney? {
        var lines = MermaidSource.lines(of: source)
        guard let header = lines.first, MermaidBandsKeyword.opens(header, on: "journey")
        else { return nil }
        lines.removeFirst()
        var journey = MermaidJourney()
        for line in lines {
            guard journey.add(line) else { return nil }
        }
        // A header and a band with nothing in them is a journey with no step in it — which is also
        // what a fence looks like halfway through arriving.
        return journey.sections.contains { !$0.tasks.isEmpty } ? journey : nil
    }

    /// One body line: the title, a band, or a task. Three rules and no fourth, which is what makes
    /// the refusal total.
    private mutating func add(_ line: String) -> Bool {
        switch MermaidBandsKeyword.read(line) {
        case let .title(named):
            title = named
        case let .section(band):
            sections.append(Section(name: band))
        case let .row(row):
            guard let task = Self.task(of: row) else { return false }
            if sections.isEmpty {
                sections.append(Section())
            }
            sections[sections.count - 1].tasks.append(task)
        case .refused:
            return false
        }
        return true
    }

    /// `Task: score` or `Task: score: Actor, Actor`, read from the RIGHT — which is what lets a
    /// task name carrying a colon still find its score.
    ///
    /// Two fields is the ONLY shape read as a task naming nobody. Any longer row takes its score
    /// from the second field back, because `T: 3: 4` otherwise scores 4 and calls the task `T: 3`
    /// — a wrong render rather than a fence.
    private static func task(of line: String) -> Task? {
        let fields = line.components(separatedBy: ":")
        guard fields.count >= 2 else { return nil }
        if fields.count == 2, let score = score(of: fields[1]) {
            return named(fields.dropLast(), score: score, actors: [])
        }
        guard fields.count >= 3, let score = score(of: fields[fields.count - 2]) else { return nil }
        return named(fields.dropLast(2), score: score, actors: actors(of: fields[fields.count - 1]))
    }

    private static func named(
        _ fields: ArraySlice<String>,
        score: Int,
        actors: [String],
    )
        -> Task? {
        let name = fields.joined(separator: ":").trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? nil : Task(name: name, score: score, actors: actors)
    }

    /// A score on mermaid's own scale, or `nil` for anything this journey cannot rate.
    private static func score(of field: String) -> Int? {
        guard let value = Int(field.trimmingCharacters(in: .whitespaces)),
              (1 ... scale).contains(value)
        else { return nil }
        return value
    }

    private static func actors(of field: String) -> [String] {
        field.components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }
}
