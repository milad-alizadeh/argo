/// What somebody answered one `AskUserQuestion` with — the composer's other other intent.
///
/// The payload is `(question, ordinals, other)` and never an ordinal alone: a call carrying two
/// questions numbers both from 1, so a number on its own does not name an option.
public struct AskAnswer: Sendable, Equatable {
    /// One question's answer, named by its place in the call.
    public struct Reply: Sendable, Equatable {
        /// Which question of the call this answers, counted from zero — the order the questions
        /// were put in, which is the order the row draws them.
        public let question: Int
        /// The options named, by the number the row draws beside them, counted from ONE. Empty
        /// where the answer named none, which is a thing a many-of question can honestly be
        /// answered with.
        public let ordinals: [Int]
        /// What was typed instead, verbatim. It carries no ordinal, because the feed numbers only
        /// what was offered.
        public let other: String?

        public init(question: Int, ordinals: [Int] = [], other: String? = nil) {
            self.question = question
            self.ordinals = ordinals
            self.other = other
        }
    }

    public let replies: [Reply]

    public init(replies: [Reply]) {
        self.replies = replies
    }
}
