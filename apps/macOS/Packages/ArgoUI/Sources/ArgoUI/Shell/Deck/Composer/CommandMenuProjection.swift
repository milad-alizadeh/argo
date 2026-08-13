import ArgoEngine

/// What the composer's `/` menu draws, derived from the catalog value and the line being typed
/// (#685, `cockpit-composer-picker.md`).
///
/// A pure function of the two: the view holds the catalog it was handed and asks this what to draw,
/// so every rule the design states — where `/` opens, what order matches come in, which characters
/// are inked — is a thing a test can hold still.
enum CommandMenuProjection {
    /// The surface, or `nil` where none opens. Nothing here is empty-but-drawn: a menu with no
    /// sections is the zero state, which carries its own line instead.
    struct Menu: Equatable {
        /// In drawing order.
        let sections: [Section]
        /// What the reader typed after the `/`, for the zero line to name back to them.
        let query: String

        /// Every row, in drawing order — what the keyboard cursor walks, so it cannot fall out of
        /// step with the sections it walks through.
        var rows: [Row] {
            sections.flatMap(\.rows)
        }

        var isEmpty: Bool {
            sections.isEmpty
        }
    }

    /// One group of rows under a sticky header, or under nothing.
    struct Section: Equatable, Identifiable {
        /// Its own, never the label: every plugin's section is labelled `Plugin`, so a label
        /// standing in as identity collides the moment two plugins carry skills.
        let id: String
        /// Absent on the prefix-match group, which is the reader's own line: a header naming it
        /// would repeat what they just typed back at them.
        let label: String?
        /// Where the rows came from and how many, beside the label and never upper-cased.
        let detail: String?
        let rows: [Row]
    }

    /// One invocable thing.
    struct Row: Equatable, Identifiable {
        var id: String {
            command
        }

        /// What goes in the draft, `/name` or `/plugin:name`.
        let command: String
        /// The characters of `command` the reader's own typing matched, inked in the accent. Empty
        /// while nothing is being filtered on.
        let matched: Range<Int>
        /// Verbatim from the frontmatter's own `description:`, first sentence only, and `nil` where
        /// the file states none — never invented (design decisions 4 and 5).
        let description: String?
        /// The origin's word, carried only while the sections group by MATCH rather than by origin
        /// — otherwise the header above the row already says it (design: not a badge on every row).
        let origin: String?
        /// Whether this row stands where one of the user's own skills would be (decision 7).
        let shadowsUser: Bool
    }

    /// The word an origin goes by. Upper-casing is the row's own, because it is a face and not a
    /// fact.
    static func word(for origin: SkillOrigin) -> String {
        switch origin {
        case .project: "Project"
        case .user: "You"
        case .plugin: "Plugin"
        }
    }
}
