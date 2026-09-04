extension FeedCall.Kind {
    /// What the count on a fold's line is a count OF — `Ran 2 Commands`, `Edited 2 Files`. The
    /// verb alone leaves the number standing on nothing, and a reader is left to infer the object
    /// from a past tense.
    ///
    /// Keyed to the KIND, and the two kinds that share a verb share this too: an MCP tool and a
    /// tool this CLI could not classify are both `Called 2 Tools`.
    var noun: FeedCall.Noun {
        switch self {
        case .search: FeedCall.Noun(one: "Pattern", many: "Patterns")
        case .read, .edit, .create, .delete, .move: FeedCall.Noun(one: "File", many: "Files")
        case .execute: FeedCall.Noun(one: "Command", many: "Commands")
        case .skill: FeedCall.Noun(one: "Skill", many: "Skills")
        case .fetch: FeedCall.Noun(one: "Page", many: "Pages")
        case .delegate: FeedCall.Noun(one: "Agent", many: "Agents")
        case .mcp, .unclassified: FeedCall.Noun(one: "Tool", many: "Tools")
        }
    }
}

extension FeedCall {
    /// What a count counts, in both its numbers. Held as a pair rather than suffixed with an `s`,
    /// because one of them is not regular and a fold of one is an ordinary line: `Searched 1
    /// Pattern` beside `Searched 2 Patterns`.
    struct Noun: Equatable, Sendable {
        let one: String
        let many: String

        func counted(_ count: Int) -> String {
            count == 1 ? one : many
        }
    }
}
