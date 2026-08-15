import ArgoEngine

/// What the waiting row is holding before it is sent — one entry per question of the call.
///
/// **One `AskUserQuestion` is one thing the agent is waiting on**, so the answer goes when EVERY
/// question has been settled, never one question at a time. What settles a question depends on
/// what it offered:
///
/// - **one-of** — a click on an option settles it outright. There is no confirm step and no
///   button, because a control that can never be the thing you press is a control that lies.
/// - **many-of, free-form, or a one-of whose `Other` was opened** — there is a field, so the act
///   has to be closed: `Answer` settles it. A second click on a box is a correction, and a
///   correction must not be a second answer.
struct FeedAskHeld: Equatable {
    /// One question's marks, keyed by the question's place in the call.
    struct Marks: Equatable {
        /// The options ticked, by the number the row draws — so what the answer names and what is
        /// on screen cannot disagree.
        var ordinals: Set<Int> = []
        /// What was typed instead. Held even while `Other` is shut, so re-opening it on a one-of
        /// question does not throw away words somebody already wrote.
        var other = ""
        /// Whether the field is open on a one-of question. A many-of question's field is open from
        /// the start — ticking two boxes and adding a word is one answer, not two acts.
        var isOtherOpen = false
        /// Whether `Answer` has been pressed for this question.
        var isClosed = false
    }

    private var marks: [Int: Marks] = [:]

    subscript(question: Int) -> Marks {
        get { marks[question] ?? Marks() }
        set { marks[question] = newValue }
    }

    /// Whether every question of the call has been settled, which is when the answer goes.
    func isSettled(_ ask: Ask) -> Bool {
        ask.questions.indices.allSatisfy { isSettled(ask.questions[$0], at: $0) }
    }

    /// Whether one question has been settled. A one-of question with a pick needs nothing further;
    /// everything else waits for its own `Answer`.
    func isSettled(_ question: Ask.Question, at index: Int) -> Bool {
        let held = self[index]
        guard needsClosing(question, at: index) else { return !held.ordinals.isEmpty }
        return held.isClosed
    }

    /// Whether this question draws a field and an `Answer` button at all.
    func needsClosing(_ question: Ask.Question, at index: Int) -> Bool {
        question.allowsMultiple || question.options.isEmpty || self[index].isOtherOpen
    }

    /// Whether that button has anything to send — the state its disabled ground draws.
    func hasSomethingToSend(_: Ask.Question, at index: Int) -> Bool {
        let held = self[index]
        return !held.ordinals.isEmpty || !held.other.trimmed.isEmpty
    }

    /// The whole call's answer, in the order the questions were put.
    ///
    /// `Other` carries no ordinal, so it travels as the words themselves — the feed numbers only
    /// what was offered, and a numbered `Other` would put the ordinals one past the ones the
    /// answer names.
    func answer(for ask: Ask) -> AskAnswer {
        AskAnswer(replies: ask.questions.indices.map { index in
            let held = self[index]
            return AskAnswer.Reply(
                question: index,
                ordinals: held.ordinals.sorted(),
                other: held.other.trimmed.isEmpty ? nil : held.other,
            )
        })
    }
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
