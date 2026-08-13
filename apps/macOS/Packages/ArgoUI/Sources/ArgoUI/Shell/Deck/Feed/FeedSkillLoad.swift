import ArgoEngine

/// A skill load as the feed reads it: the record's own value, plus the one thing the record cannot
/// answer on its own — whether the file Argo read lies outside the Session's tree.
///
/// The engine's `SkillLoad` is carried whole rather than restated. The two facts the marker draws
/// are the two the record gave, and a second spelling of them up here could drift from the file
/// that produced them.
struct FeedSkillLoad: Equatable, Sendable {
    let load: SkillLoad
    /// See `FeedPath.isExternal`. A skill routinely lives in the user's home folder rather than in
    /// the Project, and the panel's own marker is where that shows.
    let isExternal: Bool

    init(_ load: SkillLoad, within path: FeedPath = .anywhere) {
        self.load = load
        self.isExternal = path.isExternal(path.shortened(load.path))
    }

    /// What a screen reader is told. A sentence, because the row draws the label and the name as
    /// two runs, and a run is a shape rather than a word.
    var spoken: String {
        "Skill loaded: \(load.name)"
    }

    /// The ink the marker's words take. A file Argo could not read carries the failure ink the
    /// whole way across, exactly as a failed call line does — otherwise the only place the failure
    /// is stated is behind a click nobody has a reason to make.
    var ink: FeedInk {
        load.body?.hasFailed == true ? .failure : .boundary
    }

    /// What the panel shows, or `nil` where there is nothing to show.
    ///
    /// A read that FAILED still opens: the sentence saying so is the honest thing to put behind the
    /// marker, and a panel that refused to open would leave a reader guessing which of the two it
    /// was. A body Argo never had opens nothing at all.
    var opened: FeedEvidence? {
        guard let body = load.body else { return nil }
        return FeedEvidence(
            // Past tense, as every other row's verb is: a feed is the record of what happened.
            verb: "Loaded",
            symbol: ArgoSymbol.skill,
            // The skill's name in the slot a folded run counts in. `Loaded` alone reads as
            // truncated copy at the moment the reader is confirming WHICH marker they opened.
            label: load.name,
            ending: body.hasFailed ? .failed : .succeeded,
            steps: [FeedEvidence.Step(
                id: 0,
                address: .filed(load.path),
                language: .markdown,
                isExternal: isExternal,
                // DERIVED: the file was read off the machine, not owned by Argo (`CONTEXT.md` L2).
                result: .output(OutputEvidence(tier: .derived, text: body.text)),
            )],
        )
    }
}

extension SkillLoad {
    /// The `SKILL.md` under the directory the record named — what the panel is open ON, and the one
    /// address in this row.
    var path: String {
        directory + "/SKILL.md"
    }
}

extension SkillBody {
    /// What the panel prints — the instructions, or the sentence saying why there are none.
    var text: String {
        switch self {
        case let .read(markdown): markdown
        case let .unreadable(why): why
        }
    }

    var hasFailed: Bool {
        guard case .unreadable = self else { return false }
        return true
    }
}
