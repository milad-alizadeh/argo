@testable import ArgoUI

extension BacklogQueryIntentCorpus {
    /// What the ask exists for — questions a reader actually types, most carrying their own `?`.
    static let realQuestions: [Entry] = [
        "is there a ticket for the fold state bug?",
        "what state is 1293 in?",
        "who owns the swift gate ticket?",
        "did we ship the answer sheet yet?",
        "is 1242 blocked by anything?",
        "why did the macOS runner get removed?",
        "what's blocking the atlas ticket?",
        "how many open tickets mention honesty tier?",
        "is there an open ticket about rtk filters?",
        "what happened to the ordering menu?",
        "is anyone working on the answer sheet",
        "what ticket added the two marker columns",
        "which ticket removed the funnel button",
        "do we have a ticket for the pixel drift issue",
        "who is the account bound to the atlas project",
        "what does the honesty tier badge mean for a model answer",
        "is the swift gate ticket done or still open",
        "why does the field widen only while it asks",
        "what is blocking the delivery for the atlas ticket",
        "has anyone claimed the swift gate ticket yet",
        "what changed in the honesty tier doc recently",
        "is the answer sheet drawn over the ticket pane or the list pane",
    ].map { Entry(query: $0, expected: .question, group: "real question") }
}
