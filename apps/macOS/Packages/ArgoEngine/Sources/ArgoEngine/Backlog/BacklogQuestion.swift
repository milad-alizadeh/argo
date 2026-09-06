import Foundation

/// Asking the backlog a question, as the app layer reaches it (#1317).
///
/// `BacklogAskPort` and `CodexBacklogAsk` stay internal: which transport answers, and that it must
/// be one that stays on subscription-included tokens (ADR-0031), is the engine's business and not
/// a choice a caller may make. This is the one door, and it takes a question and the tickets to
/// answer it over.
public enum BacklogQuestion {
    /// Prose, and whether a model produced it.
    ///
    /// The two travel together because the surface states what an answer READ, and stating that
    /// over a refusal is a claim about a read that never happened. #1320 gives a refusal its own
    /// surface; this is the least the tracer bullet must carry so that surface has something
    /// truthful to key off.
    public struct Reply: Equatable, Sendable {
        /// What to draw — the model's words, or the refusal's own sentence.
        public let prose: String
        /// `false` for a refusal.
        public let wasRead: Bool
    }

    /// One answer, as prose the surface can draw — the model's, or the refusal's own sentence.
    ///
    /// **`nil` is reserved for nothing to ask about.** A refusal comes back as its sentence rather
    /// than as absence, because the one outcome this path must never produce is prose a reader
    /// cannot tell from a model's silence: a blank sheet reads as "the backlog has nothing to
    /// say", which is a claim about the backlog rather than about Argo.
    ///
    /// **The refusal is not yet drawn AS a refusal.** #1320 gives the failures their own surface;
    /// until it lands the sentence is honest prose on the answer sheet, which is the tracer
    /// bullet's floor — never a false empty.
    public static func answer(_ question: String, over tickets: [Ticket]) async -> Reply? {
        await answer(question, over: tickets, through: CodexBacklogAsk())
    }

    /// The same, over a port a test supplies. Its own overload so the live suite is the only thing
    /// that starts a process, and a surface can be driven without one.
    static func answer(
        _ question: String,
        over tickets: [Ticket],
        through port: some BacklogAskPort,
    ) async
        -> Reply? {
        guard !tickets.isEmpty else { return nil }
        switch await port.answer(question, over: tickets) {
        case let .success(answer): return Reply(prose: answer.prose, wasRead: true)
        case let .failure(refusal): return Reply(prose: refusal.sentence, wasRead: false)
        }
    }
}
