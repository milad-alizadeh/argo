import Foundation

/// What one managed Session has said over the companion channel.
///
/// Everything here is CONVENTION (CONTEXT.md, "Honesty tier"): it arrived over the plugin channel
/// and never existed in a transcript. That is also its limit — a Session with no channel is
/// `managed` with an EMPTY report, never demoted to external. The posture is the PTY's answer; this
/// is only what the agent chose to say through it.
public struct CompanionReport: Sendable, Equatable {
    /// The status word the agent reported, where it has reported one. Absent until it does, which
    /// is when the roster falls back to the DERIVED reading of the transcript.
    public var status: SessionStatus?
    /// A question the agent raised through the channel and nobody has answered.
    public var pendingAsk: CompanionAsk?
    /// What this Session says it produced, in the order it said so.
    public var outcomes: [CompanionOutcome] = []

    public init() {}

    public var isEmpty: Bool {
        status == nil && pendingAsk == nil && outcomes.isEmpty
    }
}

/// A question the agent asked through the channel — the CONVENTION half of `asking`, and the only
/// half that carries the options with it.
public struct CompanionAsk: Sendable, Equatable {
    public let id: String
    public let question: String
    public let options: [String]

    public init(id: String, question: String, options: [String]) {
        self.id = id
        self.question = question
        self.options = options
    }

    /// The same question in the vocabulary every surface draws a question in (#1205), so nothing
    /// downstream of the channel reinvents the conversion.
    ///
    /// One question, because the channel's shape carries one. The words and the labels are carried
    /// VERBATIM, and `allowsMultiple` is `false` because the channel has no word for it —
    /// degrade-down resolves an unstated one to the narrower act.
    public var ask: Ask {
        Ask(questions: [
            Ask.Question(text: question, options: Ask.Option.labelled(options)),
        ])
    }
}

/// A durable record of what a Session produced (CONTEXT.md L4, "Outcome"), pointing at a typed
/// target addressed in its own space.
public struct CompanionOutcome: Sendable, Equatable {
    public enum Target: String, Sendable, CaseIterable {
        /// A Diff or Delivery, git-addressed by SHA.
        case code
        /// A created Ticket, provider-id-addressed.
        case ticket
        /// A plan or research file, path-addressed and possibly uncommitted.
        case artifact
    }

    public let target: Target
    /// How that target is addressed, in its own space. Held verbatim.
    public let reference: String
    /// What the agent said it did, verbatim — never reworded into a fact.
    public let summary: String

    public init(target: Target, reference: String, summary: String) {
        self.target = target
        self.reference = reference
        self.summary = summary
    }
}
