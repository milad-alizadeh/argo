import Foundation

/// The whole of what the model is given: the instruction, the listing, and the question.
///
/// Its own type so the suite can read the prompt without starting a process — the claim that a
/// body never travels is checkable here, and unfalsifiable anywhere downstream of it.
enum BacklogAskPrompt {
    /// The listing goes above the question, so a long backlog cannot push the question out of the
    /// model's attention on the way in.
    static func text(question: String, tickets: [Ticket]) -> String {
        """
        \(instruction)

        LISTING:
        \(BacklogListing.lines(tickets))

        QUESTION: \(question)
        """
    }

    /// **"Only from the listing" is the repeatability rule, said out loud.** The model is inside a
    /// read-only sandbox in a directory holding nothing, so it could not read the repository even
    /// if it tried — this stops it answering from what it remembers of a public backlog instead.
    private static let instruction = """
    You are answering a question about a software backlog. Answer only from the listing below, \
    never from anything you already know about this project. Cite ticket numbers as #NNNN. Be \
    brief: two or three sentences. If the listing does not support an answer, say so plainly \
    rather than guessing.
    """
}
