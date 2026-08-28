import Foundation

/// Priority, which Linear holds as a rung rather than as a word.
///
/// The opposite problem from GitHub's, and the one the two-provider case forces into the open:
/// GitHub has no priority field at all and this adapter reads one off a scoped label, where Linear
/// has a real field with four fixed rungs. Argo's intent carries the provider's own WORD either
/// way, so this is the one place a word becomes a rung again.
enum LinearPriority {
    /// Linear's four rungs, in Linear's own order and its own spelling. The index is the rung, off
    /// by one: 0 is `No priority`, which is how a cleared priority is written.
    static let words = ["Urgent", "High", "Medium", "Low"]

    /// The rung Linear takes for a word, and `0` to clear it.
    ///
    /// Case-insensitive, so a caller handing back the word it READ lands on the rung it came from
    /// whatever Argo's renderer did to the casing on the way past. A word Linear has no rung for is
    /// refused rather than rounded to the nearest: rounding would file a ticket at an urgency
    /// nobody chose.
    static func rung(_ word: String?) throws -> Int {
        let asked = word?.trimmingCharacters(in: .whitespaces) ?? ""
        guard !asked.isEmpty else { return 0 }
        guard let index = words.firstIndex(where: {
            $0.caseInsensitiveCompare(asked) == .orderedSame
        }) else {
            throw WorkItemWriteError.refused(
                "Linear has no priority called \"\(asked)\"."
                    + " Its own are \(words.joined(separator: ", ")).",
            )
        }
        return index + 1
    }
}
