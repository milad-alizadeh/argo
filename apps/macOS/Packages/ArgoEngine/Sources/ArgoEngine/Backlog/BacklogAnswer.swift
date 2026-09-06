import Foundation

/// One answer to one backlog question: the prose, who answered it, and how long the reader waited.
///
/// The attribution and the duration are on the answer rather than reported beside it, because the
/// sheet draws all three together and an answer that arrived without them is one the surface would
/// have to invent a caption for.
struct BacklogAnswer: Equatable, Sendable {
    /// What the model said, verbatim and unparsed. Citations are read out of it by the surface —
    /// the port makes no claim about which tickets it names.
    let prose: String
    /// The Codex sign-in that paid for it, DERIVED from the CLI's own auth file.
    let answeredBy: CodexSignIn
    /// Wall-clock from the ask to the prose, which is the wait a reader actually sat through.
    let took: Duration
}

/// What a backlog question is asked THROUGH. One method, so a surface can be driven by a stub that
/// never starts a process, and the live suite is the only thing that runs the CLI.
protocol BacklogAskPort: Sendable {
    func answer(_ question: String, over tickets: [Ticket]) async -> Result<
        BacklogAnswer, BacklogAskRefusal,
    >
}
