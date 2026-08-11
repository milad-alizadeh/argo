/// A structured question the agent put to somebody, as the record carried it.
///
/// Held apart from the call's `target`: the words asked and the options offered are both carried
/// VERBATIM. A list, because one call can put more than one question.
public struct Ask: Sendable, Equatable {
    public struct Question: Sendable, Equatable {
        /// What was asked, verbatim.
        public let text: String
        /// The options as they were offered, in the order they were offered. Empty for a question
        /// that offered none — a free-form ask, which is a different thing from one whose options
        /// could not be read.
        public let options: [String]

        public init(text: String, options: [String]) {
            self.text = text
            self.options = options
        }
    }

    public let questions: [Question]

    public init(questions: [Question]) {
        self.questions = questions
    }
}
