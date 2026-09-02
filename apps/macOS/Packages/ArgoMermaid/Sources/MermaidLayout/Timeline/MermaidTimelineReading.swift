import Foundation

// A timeline's source, read whole or not at all — the same refusal every reader in this epic
// makes, so an unreadable fence stays the fence it is today (#859).

extension MermaidTimeline {
    /// The timeline this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidTimeline? {
        var lines = MermaidSource.lines(of: source)
        guard let header = lines.first, MermaidBandsKeyword.opens(header, on: "timeline")
        else { return nil }
        lines.removeFirst()
        var timeline = MermaidTimeline()
        for line in lines {
            guard timeline.add(line) else { return nil }
        }
        // A header and a band with nothing under it is also what a fence looks like halfway
        // through arriving.
        return timeline.sections.contains { !$0.periods.isEmpty } ? timeline : nil
    }

    /// One body line: the title, a band, or a period. Three rules and no fourth.
    private mutating func add(_ line: String) -> Bool {
        switch MermaidBandsKeyword.read(line) {
        case let .title(named):
            title = named
        case let .section(band):
            sections.append(Section(name: band))
        case let .row(row):
            guard let period = Self.period(of: row) else { return false }
            if sections.isEmpty {
                sections.append(Section())
            }
            sections[sections.count - 1].periods.append(period)
        case .refused:
            return false
        }
        return true
    }

    /// `period` on its own, or `period : event : event`. The period is what is written before the
    /// first colon, and everything after it is one event each.
    ///
    /// Every field has to say something. A row with an empty one — `2004 : A : : B`, or a `2004 :`
    /// still arriving — is refused rather than drawn with the gap closed up, because a timeline
    /// missing an event nobody can see is worse than the source.
    private static func period(of line: String) -> Period? {
        let fields = line.components(separatedBy: ":")
            .map { $0.trimmingCharacters(in: .whitespaces) }
        guard fields.allSatisfy({ !$0.isEmpty }), let name = fields.first else { return nil }
        return Period(name: name, events: Array(fields.dropFirst()))
    }
}
