/// The reading every fold of a run of calls shares: what the run did per kind, how it ended, and
/// where each call's results sit in the panel behind it.
///
/// A namespace over the calls rather than a value wrapping them, so a fold keeps its own array and
/// pays no forwarding for the facts it does not add to. Two folds hold one: `FeedSurvey` for a
/// stretch of looking, `FeedWork` for a Turn's work.
enum FeedFold {
    /// How much of one VERB the run contained. Counted in CALLS rather than in rows: three edits
    /// of one file are already one collapsed row, and the count is what the agent DID.
    ///
    /// Keyed by the verb and not by the kind, because two kinds share one: an MCP tool and a tool
    /// this CLI could not classify are both `Called`, and a tally per kind draws `Called 1 ·
    /// Called 1` over what a reader sees as two of the same thing.
    struct Tally: Equatable, Sendable {
        let verb: String
        let count: Int
    }

    /// What the run did, per verb, in the order the verbs first appeared.
    static func tallies(of calls: [FeedCall]) -> [Tally] {
        calls.reduce(into: []) { tallies, call in
            let verb = call.kind.verb
            guard let at = tallies.firstIndex(where: { $0.verb == verb }) else {
                tallies.append(Tally(verb: verb, count: call.repeats))
                return
            }
            tallies[at] = Tally(verb: verb, count: tallies[at].count + call.repeats)
        }
    }

    /// `Searched 1 · Read 3` — Argo's own verbs and Argo's own counts, never the tool's names.
    static func label(of calls: [FeedCall]) -> String {
        tallies(of: calls).map { "\($0.verb) \($0.count)" }.joined(separator: " · ")
    }

    /// Whether the line could open onto anything, so a run nobody answered offers no click.
    static func disclosure(of calls: [FeedCall]) -> FeedCall.Disclosure {
        calls.contains { !$0.evidence.isEmpty } ? .available : .none
    }

    /// The run's own ending, taken from the worst of its calls: one still running has not finished,
    /// and one that failed carries the whole line.
    static func ending(of calls: [FeedCall]) -> FeedCall.Ending {
        calls.map(\.ending).reduce(.succeeded) { $0.overtaken(by: $1) }
    }

    /// Where in the panel a given call's results start. `nil` for a call the record answered with
    /// nothing, whose name is in the list because it HAPPENED and has no step to aim at.
    static func step(_ call: Int, of calls: [FeedCall]) -> Int? {
        guard calls.indices.contains(call), !calls[call].evidence.isEmpty else { return nil }
        return calls.prefix(call).reduce(0) { $0 + $1.evidence.count }
    }

    /// The run's calls as the row lists them while the panel is open on it: what to call each, the
    /// step it goes to, how many calls it stands for, and whether it is the one that failed.
    ///
    /// The repeat count is what reconciles the list with the header: the counts above are in CALLS
    /// and a collapsed run is one entry here, so a card reading `Edited 3` over a single name
    /// would otherwise look as though it had lost two of them.
    static func listed(_ calls: [FeedCall]) -> [FeedFoldStep] {
        calls.enumerated().map { position, call in
            FeedFoldStep(call, at: position, goesTo: step(position, of: calls))
        }
    }

    /// Every result the run produced, each addressed by the call that produced it, numbered down
    /// the whole pane so a step's id is its position in it.
    ///
    /// No language on the header and one per step: a run has no ONE language, and the first file's
    /// would colour every patch under it.
    static func steps(of calls: [FeedCall]) -> [FeedEvidence.Step] {
        calls.enumerated().flatMap { numbered -> [FeedEvidence.Step] in
            let call = numbered.element
            let first = step(numbered.offset, of: calls) ?? 0
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
    }
}

/// One call in a fold's list, as the row draws it.
///
/// `goesTo` is the panel step the name points at, and `nil` for a call the record answered with
/// nothing: the name is listed because the call HAPPENED, and there is nowhere to send a press.
package struct FeedFoldStep: Equatable, Sendable, Identifiable {
    package let id: Int
    let caption: String
    let goesTo: Int?
    /// How many calls this one name stands for — see `FeedCall.repeats`. `1` for all but a
    /// collapsed run of the same work on the same subject.
    let repeats: Int
    let hasFailed: Bool

    /// Read off the call rather than filled in field by field: every one of these but the step is
    /// that call's own, and it seals a five-parameter memberwise init nobody should be writing.
    init(_ call: FeedCall, at position: Int, goesTo: Int?) {
        self.id = position
        self.caption = call.subject.captioned
        self.goesTo = goesTo
        self.repeats = call.repeats
        self.hasFailed = call.ending.hasFailed
    }

    /// The name as one sentence, for a reader who cannot see it: everything the drawn line says
    /// without words — the `×3`, and the ink the failed step takes.
    var spoken: String {
        let said: [String?] = [
            caption,
            repeats > 1 ? "\(repeats) times" : nil,
            hasFailed ? "failed" : nil,
        ]
        return said.compactMap(\.self).joined(separator: " ")
    }
}

/// A run of calls read as one row, at the grain the row draws it — whichever fold made it.
///
/// The two folds differ in three answers and share the rest, so the rest is here: `FeedSurvey` is a
/// stretch of looking, which never fails and never changes a line, and `FeedWork` is a Turn's work,
/// which does both.
package protocol FeedFolded {
    /// The calls the row stands for, in the order they happened.
    var calls: [FeedCall] { get }
    /// The run's own mark, never a kind's: the line names the kinds in words.
    var symbol: String { get }
    /// The whole line as one sentence, for a reader who cannot see it.
    var spoken: String { get }
    /// How many of the folded calls failed.
    var failures: Int { get }
    /// What the whole stretch did in lines.
    var churn: FeedCall.Churn? { get }
}

package extension FeedFolded {
    /// `Searched 1 · Read 3` — Argo's own verbs and Argo's own counts.
    var label: String {
        FeedFold.label(of: calls)
    }

    var disclosure: FeedCall.Disclosure {
        FeedFold.disclosure(of: calls)
    }

    var ending: FeedCall.Ending {
        FeedFold.ending(of: calls)
    }

    /// The calls this line lists while the panel is open on it, each pointing at its own step.
    var steps: [FeedFoldStep] {
        FeedFold.listed(calls)
    }

    /// Nothing failed and nothing changed, which is the whole of what a stretch of looking is.
    var failures: Int {
        0
    }

    var churn: FeedCall.Churn? {
        nil
    }
}

/// How the evidence panel stands over one folded row: whether it is open on this row, how to open
/// it, how to go to one of the listed calls, and which step is showing.
///
/// One value rather than four parameters on the row view, which is the cap the house keeps
/// initializers under (#755).
package struct FeedFoldOpening {
    let isOpen: Bool
    let open: () -> Void
    /// Inert by default so a specimen draws the list without a panel to send anybody to.
    var look: (Int) -> Void = { _ in }
    /// `nil` while the panel is open somewhere else, or on nothing.
    var current: Int?

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        isOpen: Bool,
        open: @escaping () -> Void,
        look: @escaping (Int) -> Void = { _ in },
        current: Int? = nil,
    ) {
        self.isOpen = isOpen
        self.open = open
        self.look = look
        self.current = current
    }
}
