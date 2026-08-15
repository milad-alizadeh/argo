/// A structured question the agent put to somebody, as the record carried it.
///
/// Held apart from the call's `target`: the words asked and the options offered are both carried
/// VERBATIM. A list, because one call can put more than one question.
public struct Ask: Sendable, Equatable {
    /// One option as it was offered: the words on the thing somebody presses, and the line under
    /// them where the host wrote one.
    public struct Option: Sendable, Equatable {
        public let label: String
        /// Absent, never empty: a host that offered no second line did not offer a blank one.
        public let detail: String?

        /// The labels as bare options, for a host that offered no second line under any of them.
        public static func labelled(_ labels: [String]) -> [Option] {
            labels.map { Option(label: $0) }
        }

        public init(label: String, detail: String? = nil) {
            self.label = label
            self.detail = detail
        }
    }

    public struct Question: Sendable, Equatable {
        /// What was asked, verbatim.
        public let text: String
        /// The options as they were offered, in the order they were offered. Empty for a question
        /// that offered none — a free-form ask, which is a different thing from one whose options
        /// could not be read.
        public let options: [Option]
        /// Whether the answer may name more than one option — the host's `multiSelect`. False
        /// where the host said nothing, because degrade-down resolves to the narrower act.
        public let allowsMultiple: Bool

        public init(text: String, options: [Option], allowsMultiple: Bool = false) {
            self.text = text
            self.options = options
            self.allowsMultiple = allowsMultiple
        }
    }

    public let questions: [Question]

    public init(questions: [Question]) {
        self.questions = questions
    }
}
