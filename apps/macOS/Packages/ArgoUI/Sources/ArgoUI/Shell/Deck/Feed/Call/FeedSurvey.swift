/// A run of looking, read as one line.
///
/// Mutations and failures are loud; observation is quiet. A turn that reads nine files before it
/// changes one is nine rows of traffic above the row worth seeing, and every one of those rows says
/// the same thing: the agent went and had a look. Folded, the turn reads as the two things that
/// happened — it looked at nine things, then it changed one.
///
/// It is a fold and never a filter. Nothing is dropped: the count is what the run did, and
/// everything the run produced is still one click behind the line.
struct FeedSurvey: Equatable, Sendable {
    /// How many of one kind the run contained. Counted in CALLS rather than in rows: three reads of
    /// one file are already one collapsed row, and `Read 1` about them would be counting lines.
    struct Tally: Equatable, Sendable {
        let kind: FeedCall.Kind
        let count: Int
    }

    /// The calls this line stands for, in the order they happened. Held whole rather than reduced
    /// to counts, because the panel behind the line is their results and nothing else.
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
    ///
    /// Counts rather than a sentence, deliberately: a sentence degrades into "read a file, read a
    /// file, read a file" at the scale this exists to survive, which is the shape it is replacing.
    var label: String {
        tallies.map { "\($0.kind.verb) \($0.count)" }.joined(separator: " · ")
    }

    /// Whether the line could open onto anything — derived from what was kept, exactly as an
    /// ordinary row derives it, so a run nobody answered offers no click.
    var disclosure: FeedCall.Disclosure {
        calls.contains { !$0.evidence.isEmpty } ? .available : .none
    }

    /// A run still waiting on one of its calls has not finished looking. Nothing in a survey ever
    /// failed — a failure is loud and breaks the run before it can be folded in.
    var ending: FeedCall.Ending {
        calls.map(\.ending).reduce(.succeeded) { $0.overtaken(by: $1) }
    }

    /// What the panel shows for this line: every result the run produced, each addressed by the
    /// call that produced it. The address is what the fold owes the reader — the line no longer
    /// names the files, so the evidence has to, and it says the whole path because the panel is the
    /// one surface in the cockpit where a path is readable at all.
    ///
    /// No language on the header and one per step. A run of looking has no ONE language: the
    /// header stands for a count across several files, and picking the first file's would colour
    /// every patch under it after whichever read happened to come first.
    /// The word the counts stand for. Never drawn on the line — `Searched 1 · Read 5` already says
    /// it — but spoken by both the row and the panel it opens, which is why it is written once.
    static let verb = "Looked at"

    var opened: FeedEvidence {
        FeedEvidence(
            verb: Self.verb,
            symbol: ArgoSymbol.looked,
            address: label,
            language: nil,
            ending: ending,
            // The counts ARE the verbs. `Looked at · Searched 1 · Read 5` says the same word twice
            // over, so the header draws the label alone and the verb survives for the ear.
            saysVerb: false,
            steps: calls.flatMap { call in
                call.evidence.map {
                    FeedEvidence.Step(address: call.address, language: call.language, result: $0)
                }
            },
        )
    }
}

extension FeedCall.Kind {
    /// Whether the call only LOOKED.
    ///
    /// Two kinds and not four: `fetch` and `delegate` read like observation and are not — a fetch
    /// reaches outside the machine and a delegation is a whole other agent's turn, and both are
    /// rare enough that folding them would save no room while hiding the loudest thing in the run.
    var isQuiet: Bool {
        switch self {
        case .read, .search: true
        case .edit, .create, .delete, .move, .execute, .skill, .fetch, .delegate, .mcp,
             .unclassified:
            false
        }
    }
}
