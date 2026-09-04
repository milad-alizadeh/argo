/// What a token-triggered picker over the composer's line draws, whichever sigil opened it — `/`
/// and `@` (#685, #687, `cockpit-composer-picker.md`).
///
/// A sigil contributes a derive returning a `Listing` and the constants on `Sigil`. The list, the
/// rows, the zero line, the cursor and what a pick does to the draft are shared, and none of them
/// reads which sigil it is serving.
enum ComposerMenu {
    /// The surface, or `nil` where the line opens none. Nothing here is empty-but-drawn: a listing
    /// with no sections is the zero state, which carries its own line instead.
    struct Listing: Equatable {
        /// In drawing order. A sigil with nothing to group by returns one unlabelled section.
        let sections: [Section]
        /// What the reader typed after the sigil, for the zero line to name back to them.
        let query: String
        let sigil: Sigil
        /// How a slower half of the catalog is doing, pinned above the list. `nil` where the sigil
        /// reads from one place and has nothing to report (design decision 9).
        var status: Status?
        /// Whether the catalog behind the rows has answered at all. A listing still being read has
        /// nothing to say about what matched, so it carries its status strip and NOT the zero line:
        /// "nothing matched" is a statement about a catalog that was looked in.
        var isReading = false
        /// How many trailing characters of the draft a pick takes with it — the query plus the
        /// sigil that opened it. `AddMenu` opens the SAME listing with this at `0` (design decision
        /// 11, #689): the sigil there was never typed, so a pick has nothing of its own to drop.
        var dropping: Int

        /// Every row, in drawing order — what the keyboard cursor walks, so it cannot fall out of
        /// step with the sections it walks through.
        var rows: [Row] {
            sections.flatMap(\.rows)
        }

        /// Whether the surface has nothing but its own zero line on it. A status strip is not
        /// content: a listing whose rows all filtered out still says nothing matched, and says the
        /// slower half is late above it.
        var isEmpty: Bool {
            sections.isEmpty
        }

        /// What picking this row does to the line.
        ///
        /// The token is the TAIL of the line for both sigils, by construction: `/` opens at the
        /// head and is closed by the first space, and `@` is the last token with no space in it.
        /// So the sigil plus what was typed after it is exactly what a pick replaces.
        func pick(_ row: Row) -> Pick {
            Pick(text: row.insert, dropping: dropping)
        }
    }

    /// One group of rows under a header, or under nothing.
    struct Section: Equatable, Identifiable {
        /// Its own, never the label: every plugin's section is labelled `Plugin`, so a label
        /// standing in as identity collides the moment two plugins carry skills.
        let id: String
        /// Absent on a group the reader would learn nothing from naming — the prefix-match group,
        /// or the single section a sigil with no grouping returns.
        let label: String?
        /// Where the rows came from and how many, beside the label and never upper-cased.
        let detail: String?
        let rows: [Row]
    }

    /// One pickable thing.
    struct Row: Equatable, Identifiable {
        let id: String
        /// What replaces the token in the draft, trailing space included — the space is what closes
        /// the menu, so the next ⏎ sends instead of picking a row again.
        let insert: String
        /// What leads the row, set in `machine`.
        let lead: String
        /// The characters of `lead` the reader's own typing matched, inked in the accent. Empty
        /// where nothing is being filtered on, or where the match is too scattered to point at.
        let matched: Range<Int>
        let detail: Detail?
        /// In drawing order, right-aligned after the detail.
        let badges: [Badge]
    }

    /// The second string on a row, and how it is set.
    struct Detail: Equatable {
        /// A `.sentence` is the row's CONTENT, so it lifts on the cursor row and yields its tail
        /// when the row is too narrow. A `.path` is the row's address: it is set in the machine
        /// face, cut from the LEFT because the tail is the part that identifies it, and it does not
        /// lift — the filename beside it is what the cursor is pointing at.
        enum Voice {
            case sentence
            case path
        }

        let words: String
        let voice: Voice
    }

    /// One mark at the end of a row.
    struct Badge: Equatable {
        /// `.quiet` is a fact about where the row came from and reads as a label. `.attention` is
        /// something the reader is being told, so it takes the attention ink and its own casing.
        enum Tone {
            case quiet
            case attention
        }

        let words: String
        let tone: Tone
    }

    /// The one line pinned above the list, and `nil` for a sigil with nothing to say.
    struct Status: Equatable {
        /// What stands before the words, and the ink both it and they take.
        enum Mark {
            /// Still being asked for — the roster's own waiting dot, so waiting looks like waiting
            /// wherever it happens.
            case waiting
            /// Asked for and refused.
            case failed
        }

        let words: String
        let mark: Mark
    }

    /// What opens a menu, and everything the shared views need to know about which one it is.
    ///
    /// A third sigil is one derive returning a `Listing`, one of these, and a line in
    /// `SessionComposer.listing` saying when it answers. No view, no row type, no cursor.
    struct Sigil: Equatable {
        /// The character the reader typed, said back to them on the zero line.
        let mark: Character
        /// What a screen reader calls the surface.
        let label: String
        /// The zero line's opening words, which name what did not match. The rest of that line is
        /// `ComposerMenuZeroLine.tail`, shared, because the reassurance is the same either way.
        let nothingMatched: String

        static let command = Sigil(
            mark: "/",
            label: "Skills and commands",
            nothingMatched: "No skill or command matches ",
        )

        static let file = Sigil(
            mark: "@",
            label: "Files in this Workspace",
            nothingMatched: "No file in this Workspace matches ",
        )
    }

    /// What a picked row does to the line: the last `dropping` characters go, and `text` lands in
    /// their place. Counted rather than indexed, because a `String.Index` taken off one line and
    /// used against another is a crash rather than a wrong answer.
    struct Pick: Equatable {
        let text: String
        let dropping: Int

        /// The line this pick leaves. `ComposerDraft.take(_:)` writes it back, and
        /// `ComposerMenus.completes(on:)` asks it what ⏎ would change.
        func taken(over line: String) -> String {
            String(line.dropLast(dropping)) + text
        }
    }
}
