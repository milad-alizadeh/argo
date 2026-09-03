import Foundation

/// What a transcript's shape IS, as named numbers: the facts a synthetic has to hold to stand in
/// for the Session it was made from, and the only facts about it a checked-in fixture can be
/// judged against once the real file is gone.
///
/// One flat table of named numbers: the record half is counted here and the row half by whoever
/// can project one, and a regenerated fixture then reads as a diff of numbers.
package struct SyntheticShape: Codable, Equatable {
    package let counts: [String: Int]

    package init(counts: [String: Int]) {
        self.counts = counts
    }

    /// The record half, off the lines themselves: how many records there are, what kinds they are,
    /// what parts their messages carry, which tools they call, and how much text is in them.
    package init(lines: [String]) {
        var counts: [String: Int] = ["records": lines.count]
        for line in lines {
            guard let data = line.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: data),
                  let record = parsed as? [String: Any]
            else {
                counts["records.unreadable", default: 0] += 1
                continue
            }
            Self.count(record, into: &counts)
        }
        self.counts = counts
    }

    /// The two shapes side by side, so a generation that changed something can say WHICH number
    /// moved. Empty where they agree.
    package func differences(against other: SyntheticShape) -> [String] {
        Set(counts.keys).union(other.counts.keys).sorted().compactMap { name in
            let mine = counts[name] ?? 0
            let theirs = other.counts[name] ?? 0
            return mine == theirs ? nil : "\(name): \(mine) against \(theirs)"
        }
    }

    /// This shape with more facts folded in — how the generator adds the row half it alone can
    /// count.
    package func adding(_ more: [String: Int]) -> SyntheticShape {
        SyntheticShape(counts: counts.merging(more) { _, fresh in fresh })
    }

    private static func count(_ record: [String: Any], into counts: inout [String: Int]) {
        let type = record["type"] as? String ?? "none"
        counts["records.\(type)", default: 0] += 1
        counts["text.lines", default: 0] += lines(in: record)
        if record["isSidechain"] as? Bool == true {
            counts["records.sidechain", default: 0] += 1
        }
        let message = record["message"] as? [String: Any]
        for part in message?["content"] as? [[String: Any]] ?? [] {
            block(part, into: &counts)
        }
        if let prose = message?["content"] as? String {
            counts["blocks.text", default: 0] += 1
            counts["text.length", default: 0] += prose.utf8.count
        }
    }

    /// Every line break in every string the record holds, however deep it sits.
    ///
    /// A call's output is the largest text in a transcript and the feed draws it a line at a time,
    /// so its line count is the row's height. Lines rather than bytes because an id is remapped
    /// to one of a different length and carries no line break, so this is the one length fact a
    /// synthetic can hold EXACTLY.
    private static func lines(in raw: Any) -> Int {
        switch raw {
        case let text as String: text.utf8.reduce(0) { $0 + ($1 == UInt8(ascii: "\n") ? 1 : 0) }
        case let record as [String: Any]: record.values.reduce(0) { $0 + lines(in: $1) }
        case let list as [Any]: list.reduce(0) { $0 + lines(in: $1) }
        default: 0
        }
    }

    private static func block(_ part: [String: Any], into counts: inout [String: Int]) {
        let type = part["type"] as? String ?? "none"
        counts["blocks.\(type)", default: 0] += 1
        if let name = part["name"] as? String {
            counts["tools.\(name)", default: 0] += 1
        }
        for field in ["text", "thinking"] {
            guard let prose = part[field] as? String else { continue }
            counts["text.length", default: 0] += prose.utf8.count
        }
    }
}
