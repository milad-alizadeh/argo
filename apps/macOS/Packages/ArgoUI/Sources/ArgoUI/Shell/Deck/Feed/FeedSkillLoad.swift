import ArgoDesign
import ArgoEngine

/// A skill load as the feed says it: the record's own value, and the `SKILL.md` addressed the way
/// every other file in this feed is — relative to where the Session is working.
package struct FeedSkillLoad: Equatable, Sendable {
    package let load: SkillLoad
    /// The file Argo read, shortened against the Session's cwd. Absolute in the record: a skill
    /// routinely lives in the user's home folder rather than in the Project.
    package let address: String
    /// See `FeedPath.isExternal`, asked of what the shortening LEFT.
    let isExternal: Bool

    package init(_ load: SkillLoad, within path: FeedPath = .anywhere) {
        self.load = load
        self.address = path.shortened(load.path)
        self.isExternal = path.isExternal(address)
    }

    /// What a screen reader is told. The row draws its label and its name as two runs, and a run is
    /// a shape rather than a word.
    package var spoken: String {
        "Skill loaded: \(load.name)"
    }

    /// The ink the marker's words take. A failure is the only outcome in this feed with a colour,
    /// and the row is where it has to be said: the panel is behind a click.
    var ink: FeedInk {
        load.body?.hasFailed == true ? .failure : .boundary
    }

    /// What the panel shows, or `nil` where there is nothing to show. A read that FAILED still
    /// opens, on the sentence saying so.
    var opened: FeedEvidence? {
        guard let body = load.body else { return nil }
        return FeedEvidence(
            // Past tense, as every other row's verb is: a feed is the record of what happened.
            verb: "Loaded",
            symbol: ArgoSymbol.skill,
            // The name in the slot a folded run counts in, so the header says WHICH skill.
            label: load.name,
            ending: body.hasFailed ? .failed : .succeeded,
            steps: [FeedEvidence.Step(
                id: 0,
                address: .filed(address),
                language: .markdown,
                isExternal: isExternal,
                // Argo read this file itself, so the panel's text IS the file — the reason it needs
                // no host gutter to be drawn as one (#736).
                holdsTheFile: true,
                // DERIVED: the file was read off the machine, not owned by Argo (`CONTEXT.md` L2).
                result: .output(OutputEvidence(tier: .derived, text: body.text)),
            )],
        )
    }
}
