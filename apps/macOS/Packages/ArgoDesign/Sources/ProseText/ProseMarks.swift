import Foundation

/// The agent's own inline marks, read once per string.
///
/// Here and not beside the feed's other readings because every width in the feed rests on it: a
/// measurement is of the RENDERED words, so the marks have to come off before Core Text ever sees
/// them. `ProseReading` holds the rest of what a string is read into and forwards this one, so
/// there is still one store behind the whole feed.
@MainActor
public enum ProseMarks {
    private static var marks = ProseCache<AttributedString>()

    /// See `FeedProseText` for why the read is inline-only.
    public static func marked(_ text: String) -> AttributedString {
        marks.reading(of: text) { text in
            let parsed = try? AttributedString(
                markdown: text,
                options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace),
            )
            return parsed ?? AttributedString(text)
        }
    }
}
