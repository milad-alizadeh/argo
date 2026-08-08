/// A stretch of the record nothing could parse, read as one line.
///
/// The feed's only row that is not a reading of what the agent did — it is a reading of what the
/// reader could not do. That is why it is here rather than dropped: the line existed, something
/// wrote it, and a surface that skips it silently cannot tell a quiet session from a corrupt file.
///
/// A run rather than a row apiece, for the same reason a run of reads folds: a truncated write
/// leaves a tail of them, and a corrupt file would otherwise fill the screen with the same row.
struct FeedUnreadable: Equatable, Sendable {
    /// The raw text of each line, in the order the record wrote them. Held verbatim — it is the
    /// only thing that lets a reader check the claim, and Argo has nothing to add to it.
    let lines: [String]

    var count: Int {
        lines.count
    }

    /// What the line says, in Argo's own voice. It says how MANY rather than what they were: the
    /// text is on the row already, and a count is the part that a shortened line cannot carry.
    var label: String {
        count == 1 ? "1 line could not be read" : "\(count) lines could not be read"
    }

    /// The whole raw text, which is what the row shows once the reader asks for it. Joined on
    /// newlines because that is how the record held them.
    ///
    /// It is what the row DRAWS and never what it speaks: this is malformed JSON, and reading a
    /// truncated object aloud tells a listener nothing the count has not already said.
    var raw: String {
        lines.joined(separator: "\n")
    }
}

/// Where a run of unreadable lines starts and where it stops: at the first thing that WAS readable.
///
/// Consecutive only, exactly as `FeedCallRun` and `FeedSurveyFold` are. Two unreadable lines with a
/// message between them are two separate moments, and one row standing for both would put a line in
/// the feed claiming a stretch that never happened.
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
