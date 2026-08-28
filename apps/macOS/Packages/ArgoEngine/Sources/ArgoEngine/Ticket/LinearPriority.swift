import Foundation

/// Priority, which Linear holds as a rung where GitHub has no field at all and reads one off a
/// scoped label. The intent carries the provider's own WORD either way, so this is the one place a
/// word becomes a rung again (#371).
enum LinearPriority {
    /// Linear's four rungs, in Linear's own order and its own spelling. The index is the rung, off
    /// by one: 0 is `No priority`, which is how a cleared priority is written.
    static let words = ["Urgent", "High", "Medium", "Low"]

    /// The rung Linear takes for a word, and `0` to clear it. Case-insensitive, so a word read
    /// back lands on the rung it came from; an unknown one is refused rather than rounded to the
    /// nearest, which would file a ticket at an urgency nobody chose.
    static func rung(_ word: String?) throws -> Int {
        let asked = word?.trimmingCharacters(in: .whitespaces) ?? ""
        guard !asked.isEmpty else { return 0 }
        guard let index = words.firstIndex(where: {
            $0.caseInsensitiveCompare(asked) == .orderedSame
        }) else {
            throw TicketWriteError.refused(
                "Linear has no priority called \"\(asked)\"."
                    + " Its own are \(words.joined(separator: ", ")).",
            )
        }
        return index + 1
    }
}
