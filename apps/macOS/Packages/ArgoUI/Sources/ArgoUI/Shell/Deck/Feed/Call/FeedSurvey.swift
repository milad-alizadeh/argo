import ArgoDesign

/// A run of looking, read as one line.
///
/// A fold and never a filter: nothing is dropped, the count is what the run did, and everything
/// the run produced is still one click behind the line.
package struct FeedSurvey: Equatable, Sendable {
    /// How many of one kind the run contained. Counted in CALLS rather than in rows: three reads of
    /// one file are already one collapsed row.
    struct Tally: Equatable, Sendable {
        let kind: FeedCall.Kind
        let count: Int
    }

    /// The calls this line stands for, in the order they happened.
    let calls: [FeedCall]

    /// What the run did, per kind, in the order the kinds first appeared.
    var tallies: [Tally] {
        calls.reduce(into: []) { tallies, call in
            guard let at = tallies.firstIndex(where: { $0.kind == call.kind }) else {
                tallies.append(Tally(kind: call.kind, count: call.repeats))
                return
            }
            tallies[at] = Tally(kind: call.kind, count: tallies[at].count + call.repeats)
        }
    }

    /// `Searched 1 · Read 3` — Argo's own verbs and Argo's own counts.
    var label: String {
        tallies.map { "\($0.kind.verb) \($0.count)" }.joined(separator: " · ")
    }

    /// Whether the line could open onto anything, so a run nobody answered offers no click.
    var disclosure: FeedCall.Disclosure {
        calls.contains { !$0.evidence.isEmpty } ? .available : .none
    }

    /// A run still waiting on one of its calls has not finished looking. Nothing in a survey ever
    /// failed — a failure is loud and breaks the run before it can be folded in.
    var ending: FeedCall.Ending {
        calls.map(\.ending).reduce(.succeeded) { $0.overtaken(by: $1) }
    }

    /// The word the counts stand for. Never drawn on the line, but spoken by both the row and the
    /// panel it opens.
    static let verb = "Looked at"

    /// The whole line as one sentence, for a reader who cannot see it. The verb comes back,
    /// because a mark says nothing in the ear.
    package var spoken: String {
        [Self.verb, label, ending.spoken].compactMap(\.self).joined(separator: " ")
    }

    /// What the panel shows for this line: every result the run produced, each addressed by the
    /// call that produced it, whole path included — the line no longer names the files.
    ///
    /// No language on the header and one per step: a run of looking has no ONE language, and the
    /// first file's would colour every patch under it.
    package var opened: FeedEvidence {
        FeedEvidence(
            verb: Self.verb,
            symbol: ArgoSymbol.looked,
            label: label,
            ending: ending,
            steps: calls.enumerated().flatMap(steps(of:)),
        )
    }

    /// Where in the panel a given call's results start. `nil` for a call the record answered with
    /// nothing, whose name is in the list because it HAPPENED and has no step to aim at.
    func step(of call: Int) -> Int? {
        guard calls.indices.contains(call), !calls[call].evidence.isEmpty else { return nil }
        return calls.prefix(call).reduce(0) { $0 + $1.evidence.count }
    }

    /// One call's results as panel steps, numbered from where its own results begin so a step's id
    /// is its position down the whole pane.
    private func steps(of numbered: (offset: Int, element: FeedCall)) -> [FeedEvidence.Step] {
        let call = numbered.element
        let first = step(of: numbered.offset) ?? 0
        return call.evidence.enumerated().map { position, result in
            FeedEvidence.Step(
                id: first + position,
                address: call.caption,
                language: call.language,
                isExternal: call.isExternalSubject,
                holdsTheFile: call.holdsTheFile,
                result: result,
            )
        }
    }

    /// How long the fold's line runs, in characters: a verb and a small number per tally.
    var length: Int {
        tallies.reduce(0) { $0 + $1.kind.verb.utf8.count + 3 }
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
