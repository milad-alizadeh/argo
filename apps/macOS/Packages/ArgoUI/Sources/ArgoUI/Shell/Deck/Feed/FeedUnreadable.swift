/// A stretch of the record nothing could parse, read as one line. Kept rather than dropped: a
/// surface that skips it silently cannot tell a quiet session from a corrupt file. Folded into a
/// run because a truncated write leaves a tail of them.
struct FeedUnreadable: Equatable, Sendable {
    /// The raw text of each line, in the order the record wrote them, verbatim.
    let lines: [String]

    var count: Int {
        lines.count
    }

    /// What the line says, in Argo's own voice: how MANY rather than what they were.
    var label: String {
        count == 1 ? "1 line could not be read" : "\(count) lines could not be read"
    }

    /// The whole raw text, shown once the reader asks for it. Joined on newlines because that is
    /// how the record held them. DRAWN and never spoken — this is malformed JSON.
    var raw: String {
        lines.joined(separator: "\n")
    }
}

/// Where a run of unreadable lines starts and where it stops: at the first thing that WAS readable.
/// Consecutive only, exactly as `FeedCallRun` and `FeedSurveyFold` are — two unreadable lines with
/// a message between them are two separate moments.
enum FeedUnreadableRun {
    static func folded(_ contents: [FeedRow.Content]) -> [FeedRow.Content] {
        contents.reduce(into: []) { rows, content in
            guard case let .unreadable(next) = content,
                  case let .unreadable(previous) = rows.last
            else {
                rows.append(content)
                return
            }
            rows[rows.count - 1] = .unreadable(
                FeedUnreadable(lines: previous.lines + next.lines),
            )
        }
    }
}
