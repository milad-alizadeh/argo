import ArgoDesign

/// A run of looking, read as one line.
///
/// A fold and never a filter: nothing is dropped, the count is what the run did, and everything
/// the run produced is still one click behind the line.
package struct FeedSurvey: Equatable, Sendable, FeedFolded {
    package let calls: [FeedCall]

    /// One mark for the run and not one per kind — the line already names the kinds in words.
    package var symbol: String {
        ArgoSymbol.looked
    }

    /// The word the counts stand for. Never drawn on the line, but spoken by both the row and the
    /// panel it opens.
    static let verb = "Looked at"

    /// The whole line as one sentence, for a reader who cannot see it. The verb comes back,
    /// because a mark says nothing in the ear.
    ///
    /// Nothing in a survey ever failed and nothing in one ever changed a line, so the two facts
    /// `FeedFolded` adds for the Turn's card are the protocol's own defaults here.
    package var spoken: String {
        [Self.verb, label, ending.spoken].compactMap(\.self).joined(separator: " ")
    }

    /// What the panel shows for this line: every result the run produced, each addressed by the
    /// call that produced it, whole path included — the line no longer names the files.
    package var opened: FeedEvidence {
        FeedEvidence(
            verb: Self.verb,
            symbol: symbol,
            label: label,
            ending: ending,
            steps: FeedFold.steps(of: calls),
        )
    }
}

extension FeedCall {
    /// Whether the call only LOOKED.
    ///
    /// `fetch` and `delegate` read like observation and are not — a fetch reaches outside the
    /// machine and a delegation is a whole other agent's turn — so neither is quiet.
    ///
    /// An `execute` cannot be answered from the kind: a `cat` and a `git push` are the same kind,
    /// so the question moves to the command text, which is what makes it work on a Codex Session.
    /// A call standing in for no command at all is loud, like anything unread.
    var onlyLooks: Bool {
        switch kind {
        case .read, .search: true
        case .execute: command.map(FeedQuietCommand.onlyLooks(at:)) ?? false
        case .edit, .create, .delete, .move, .skill, .fetch, .delegate, .mcp, .unclassified: false
        }
    }

    /// The command the row is standing in for, whether it drew the command itself or the sentence
    /// the agent wrote about it.
    private var command: String? {
        switch subject {
        case let .command(command): command
        case let .narration(_, standingIn: target): target
        case .file, .plain: nil
        }
    }
}
