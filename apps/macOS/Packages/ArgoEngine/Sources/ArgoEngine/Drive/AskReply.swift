import Foundation

/// The answer, spelled as the one thing the hook has a word for.
///
/// A `PreToolUse` hook's whole vocabulary is `allow · deny · ask`, and none of them is "the user
/// picked option 2". So an answered ask is a **deny whose reason IS the answer**: the picker never
/// runs, and what the agent reads in its place is what somebody said in the cockpit. The one seam
/// that knows this — everything above it deals in `(question, ordinals, other)`.
///
/// Its own type for the reason `PermissionReply` is: what goes down the socket is a pure function
/// of what was answered, and the wire format is worth reading in one place.
enum AskReply {
    static func line(for ask: SessionAsk, answering answer: AskAnswer) -> String {
        line(reason: reason(for: ask, answering: answer))
    }

    /// What the gate says when its own clock ran out. Its own wording, not `PermissionReply`'s: a
    /// question is not a Permission, and telling the agent a *permission* expired would name the
    /// wrong act in the one record anybody reads afterwards.
    static let expired = line(
        reason: "The question expired in Argo — nobody answered it",
    )

    /// An empty line where the answer could not be encoded, which is the same fail-closed path
    /// `PermissionReply` takes: the hook script reads an empty reply as Argo being unreachable and
    /// denies on its own account, so the turn is never left running on a reply nobody wrote.
    private static func line(reason: String) -> String {
        CompanionResponse.line([
            "hookSpecificOutput": [
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            ],
        ]) ?? ""
    }

    /// The answer in words, on ONE line: the socket frames on newlines, so a reason spanning two
    /// would be read as two replies and the second would arrive at whatever asked next.
    ///
    /// Named by the question's own words rather than by its number, because that is what tells two
    /// questions of one call apart.
    private static func reason(for ask: SessionAsk, answering answer: AskAnswer) -> String {
        let said = answer.replies.compactMap { reply -> String? in
            guard ask.questions.indices.contains(reply.question) else { return nil }
            let question = ask.questions[reply.question]
            return "\(question.text) → \(chosen(in: question, by: reply))"
        }
        return (["Answered in Argo, by the person this Session belongs to."] + said)
            .joined(separator: " · ")
    }

    /// What one reply named, spelled with the numbers the row draws beside the options — so the
    /// ordinals the answer carries and the ones on screen cannot disagree.
    ///
    /// An ordinal nothing was offered under is dropped: the answer names what was offered, and
    /// inventing an option for a number out of range would answer on somebody else's behalf.
    private static func chosen(in question: Ask.Question, by reply: AskAnswer.Reply) -> String {
        let named = reply.ordinals
            .sorted()
            .filter { question.options.indices.contains($0 - 1) }
            .map { "\($0). \(question.options[$0 - 1].label)" }
        // `Other` carries no number, so it is appended as the words themselves.
        let typed = reply.other.map(trimmed).flatMap { $0.isEmpty ? nil : $0 }
        let all = named + [typed].compactMap(\.self)
        return all.isEmpty ? "no option chosen" : all.joined(separator: ", ")
    }

    private static func trimmed(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
