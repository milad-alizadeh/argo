import Foundation

/// One tool call's arguments, read into a fact.
///
/// Every read is total: a field that is not the type it should be is absent, not a default. A tool
/// whose required argument is missing produces no fact at all, so the agent gets a refusal rather
/// than the cockpit getting an invented one.
enum CompanionArguments {
    static func fact(
        for tool: CompanionTool,
        from arguments: JSONValue,
        callID: JSONValue?,
    )
        -> CompanionFact? {
        switch tool {
        case .reportStatus: status(from: arguments)
        case .askUser: ask(from: arguments, callID: callID)
        case .reportOutcome: outcome(from: arguments)
        case .reportReady: ready(from: arguments)
        }
    }

    private static func status(from arguments: JSONValue) -> CompanionFact? {
        guard let word = arguments.stringField("status") else { return nil }
        return .status(CompanionTool.status(named: word))
    }

    /// A question with no WORDS is refused here, exactly as `AskReading` refuses one on the
    /// transcript channel: an ask nobody can read is not one anybody can answer, and inventing a
    /// blank row for it would stand an empty card at the foot of the reading. The agent gets the
    /// refusal instead, which is what reading at a boundary is for.
    private static func ask(from arguments: JSONValue, callID: JSONValue?) -> CompanionFact? {
        guard let question = arguments.stringField("question"), !question.isEmpty
        else { return nil }
        return .ask(CompanionAsk(
            // The call's own id: the agent never sends one, and this is the only handle both sides
            // already share for the question being asked.
            id: identifier(callID),
            question: question,
            // A blank label goes the same way, one at a time rather than all of them: an option
            // with nothing on it is a number beside empty space, and the question is still
            // answerable without it.
            options: arguments["options"]?.array.compactMap(\.string).filter { !$0.isEmpty } ?? [],
        ))
    }

    /// Unlike the other three, a shape this cannot read never drops the claim — the reason is the
    /// FEED's fact, never the roster's, and the badge the reason is missing from still has to
    /// draw. A blank or absent reason degrades to `nil` rather than an empty string standing in
    /// for one.
    private static func ready(from arguments: JSONValue) -> CompanionFact? {
        .ready(CompanionReady.reading(arguments))
    }

    private static func outcome(from arguments: JSONValue) -> CompanionFact? {
        guard let word = arguments.stringField("target"),
              let target = CompanionOutcome.Target(rawValue: word),
              let reference = arguments.stringField("reference"),
              let summary = arguments.stringField("summary")
        else { return nil }
        return .outcome(CompanionOutcome(target: target, reference: reference, summary: summary))
    }

    private static func identifier(_ callID: JSONValue?) -> String {
        switch callID {
        case let .string(value): value
        case let .number(value): String(Int(value))
        case .bool, .array, .object, .null, .none: "ask"
        }
    }
}
